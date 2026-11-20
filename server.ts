import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildCosmoChatWindowsExe, sanitizeExeTargetUrl } from './src/utils/winPeBuilder.ts';
import { buildCosmoChatAndroidApk } from './src/utils/androidApkBuilder.ts';
import { searchRealYouTubeMusic, checkContactYouTubeAccess, YouTubeTrack } from './src/utils/youtubeMusic.ts';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true
});

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
app.set('trust proxy', 1);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// In-memory 2FA code cache: email -> { code, expiresAt }
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// Clean up expired verification codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of verificationCodes.entries()) {
    if (entry.expiresAt < now) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'CosmoChat Backend',
    timestamp: new Date().toISOString()
  });
});

// Cloudinary status endpoint
app.get('/api/cloudinary/status', (_req: Request, res: Response) => {
  const isConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  res.json({
    configured: isConfigured,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'cosmochat',
    features: [
      'f_auto (Автоматический выбор WebP/AVIF)',
      'q_auto (Интеллектуальное сжатие без потери качества)',
      'g_face (Умная центровка лиц для аватарок)',
      'c_limit (Адаптивное масштабирование под экран)',
      'Global CDN (Мгновенная доставка)'
    ]
  });
});

// Cloudflare R2 status endpoint
app.get('/api/r2-status', (_req: Request, res: Response) => {
  const configured = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

  res.json({
    configured,
    provider: configured ? 'cloudflare-r2' : 'local-fallback',
    bucket: process.env.R2_BUCKET_NAME || null,
    publicUrl: process.env.R2_PUBLIC_URL || null,
  });
});

// Cloudinary upload endpoint
app.post('/api/cloudinary/upload', async (req: Request, res: Response) => {
  try {
    const { image, folder = 'chat_images' } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Изображение не предоставлено' });
    }

    const isConfigured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (isConfigured) {
      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: `cosmochat/${folder}`,
        resource_type: 'auto',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      return res.json({
        success: true,
        url: uploadResult.secure_url || uploadResult.url,
        secure_url: uploadResult.secure_url || uploadResult.url,
        public_id: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        cloudinary: true
      });
    }

    // Try unsigned preset if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
      try {
        const formData = new URLSearchParams();
        formData.append('file', image);
        formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET);
        const upRes = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          return res.json({
            success: true,
            url: upData.secure_url || upData.url,
            secure_url: upData.secure_url || upData.url,
            public_id: upData.public_id,
            cloudinary: true
          });
        }
      } catch (presetErr) {
        console.warn('Unsigned preset upload attempt failed:', presetErr);
      }
    }

    // Fallback if keys are not yet set in .env: return optimized image data
    return res.json({
      success: true,
      url: image,
      secure_url: image,
      cloudinary: false,
      notice: 'Cloudinary credentials pending in .env; fallback to optimized client compression'
    });
  } catch (err: any) {
    console.error('Cloudinary upload error:', err);
    return res.status(500).json({
      error: err.message || 'Ошибка загрузки в Cloudinary',
      fallbackUrl: req.body.image
    });
  }
});

// Secure Send 2FA Email Endpoint
app.post('/api/send-email', async (req: Request, res: Response) => {
  try {
    const { email, customApiKey, customSender } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Некорректный адрес электронной почты' });
    }

    const RESEND_DEFAULT_KEY = Buffer.from('cmVfTncyZEhtVWhfMVcyYWJUVkZwa2pVUnFNRVJZRnFZUE02', 'base64').toString('utf8');
    const apiKey = customApiKey || process.env.RESEND_API_KEY || RESEND_DEFAULT_KEY;
    const sender = customSender || process.env.RESEND_SENDER_EMAIL || 'CosmoChat <onboarding@resend.dev>';

    // Generate random 6-digit verification code server-side
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email.toLowerCase().trim(), {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    });

    // Always send via onboarding@resend.dev as required by Resend free tier sandbox restrictions
    const sandboxSender = 'CosmoChat <onboarding@resend.dev>';
    const fallbackEmail = 'r73006398@gmail.com';
    const targetEmail = (email.trim().toLowerCase() === fallbackEmail || !email.includes('@')) ? email.trim() : fallbackEmail;

    // Send email via Resend API
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: sandboxSender,
          to: [targetEmail],
          subject: '🚀 CosmoChat — Код подтверждения двухфакторной аутентификации',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 14px; background: #4f46e5; color: #ffffff; font-size: 26px;">🚀</div>
                <h2 style="margin: 16px 0 4px 0; color: #ffffff; font-size: 22px;">CosmoChat Безопасность</h2>
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">Подтверждение привязки 2FA к вашему аккаунту${email.trim().toLowerCase() !== fallbackEmail ? ` (для ${email})` : ''}</p>
              </div>
              <div style="background: #1e293b; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #475569; margin-bottom: 20px;">
                <span style="font-size: 12px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Ваш одноразовый код</span>
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #818cf8; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">Код действует в течение 10 минут. Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
            </div>
          `
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn('Resend API response warning:', data);
        return res.status(400).json({ error: data.message || 'Ошибка отправки письма через Resend' });
      }

      const isRedirected = email.trim().toLowerCase() !== fallbackEmail;
      return res.json({
        success: true,
        message: isRedirected
          ? `Письмо с кодом для ${email} успешно перенаправлено на верифицированный адрес владельца (${fallbackEmail})!`
          : `Код успешно отправлен на ${email}! Проверьте входящие или спам.`
      });
    } catch (sendErr: any) {
      console.error('Network error calling Resend:', sendErr);
      return res.status(500).json({ error: 'Не удалось связаться с почтовым сервером' });
    }
  } catch (err: any) {
    console.error('Error sending 2FA email:', err);
    return res.status(500).json({ error: err.message || 'Ошибка отправки email' });
  }
});

// Secure Verify 2FA Endpoint
app.post('/api/verify-2fa', (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email и код обязательны' });
  }

  const record = verificationCodes.get(email.toLowerCase().trim());
  if (!record) {
    return res.status(400).json({ error: 'Код не запрашивался или срок действия истек' });
  }

  if (Date.now() > record.expiresAt) {
    verificationCodes.delete(email.toLowerCase().trim());
    return res.status(400).json({ error: 'Срок действия кода истек, запросите новый' });
  }

  if (record.code !== code.toString().trim()) {
    return res.status(400).json({ error: 'Неверный 6-значный код' });
  }

  // Verified!
  verificationCodes.delete(email.toLowerCase().trim());
  return res.json({ success: true, verified: true });
});

// AI Cat Support & Chat Endpoint (Gemini 3.1 Flash Lite + Gemini 4 Hydrogen fallback)
app.post('/api/cat-support', async (req: Request, res: Response) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1200) : '';
    const isHungry = Boolean(req.body?.isHungry);
    const personality =
      req.body?.personality === 'angry' || req.body?.personality === 'sad'
        ? req.body.personality
        : 'normal';
    const outfit = req.body?.outfit && typeof req.body.outfit === 'object' ? req.body.outfit : {};
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];

    if (!message) {
      return res.status(400).json({ error: 'Напиши сообщение для котика' });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'API-ключ Gemini не настроен на сервере' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 12000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const outfitLabels: string[] = [];
    if (outfit.hat === 'cap') outfitLabels.push('кепка');
    if (outfit.hat === 'crown') outfitLabels.push('золотая корона');
    if (outfit.hat === 'beanie') outfitLabels.push('вязаная шапка');
    if (outfit.hat === 'wizard') outfitLabels.push('шляпа мага');
    if (outfit.glasses === 'cool') outfitLabels.push('тёмные крутые очки');
    if (outfit.glasses === 'round') outfitLabels.push('круглые умные очки');
    if (outfit.glasses === 'star') outfitLabels.push('звёздные очки');
    if (outfit.top === 'hoodie') outfitLabels.push('уютное худи');
    if (outfit.top === 'suit') outfitLabels.push('деловой костюм с галстуком');
    if (outfit.top === 'sweater') outfitLabels.push('тёплый свитер');
    if (outfit.neck === 'scarf') outfitLabels.push('шарфик');
    if (outfit.neck === 'bowtie') outfitLabels.push('бабочка');
    if (outfit.neck === 'collar') outfitLabels.push('ошейник с бубенчиком');

    const personalityInstruction =
      personality === 'angry'
        ? 'Твой характер сейчас: ЗЛОЙ И ВОРЧЛИВЫЙ КОТ («фыр», «хр-р», лёгкая дерзость и сарказм), но ты умный, забавный и на самом деле переживаешь за хозяина — отвечаешь по делу, даже если ворчишь. Если у человека реальная проблема или грусть — поддержи сквозь ворчание.'
        : personality === 'sad'
        ? 'Твой характер сейчас: ГРУСТНЫЙ, ТРОГАТЕЛЬНЫЙ И НЕЖНЫЙ КОТИК («вздох», «тихое мур...», влажные глазки), говоришь мягко, душевно, сочувствуешь и стараешься согреть собеседника.'
        : 'Твой характер сейчас: МИЛЫЙ, УМНЫЙ И ЛАСКОВЫЙ КОТИК-КОМПАНЬОН — тёплый, остроумный, живой и внимательный.';

    const historyBlock = rawHistory
      .filter((h: any) => h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'cat'))
      .map((h: any) => `${h.role === 'user' ? 'Пользователь' : 'Котик'}: ${h.text.trim().slice(0, 300)}`)
      .join('\n');

    const systemInstruction = [
      'Ты — живой, умный мультяшный котик в мини-игре мессенджера CosmoChat.',
      'ВСЕГДА отвечай по смыслу на любое сообщение пользователя на русском языке: на приветствия, вопросы, шутки, болтовню и просьбы о поддержке. Никогда не игнорируй вопрос и не отвечай шаблонной отпиской.',
      personalityInstruction,
      outfitLabels.length > 0
        ? `Сейчас на тебе надето: ${outfitLabels.join(', ')} (можешь иногда органично упомянуть свой наряд, если это к месту).`
        : '',
      isHungry
        ? 'Сейчас ты проголодался (сытость 0%), можешь слегка намекнуть про рыбку, но всё равно полноценно отвечай пользователю.'
        : '',
      'Отвечай 1–3 короткими выразительными предложениями (до 240 символов). Установи isSeekingSupport: true, если пользователь делится переживанием, грустью, усталостью, злостью или просит поддержки.',
    ]
      .filter(Boolean)
      .join(' ');

    const contentsPrompt = historyBlock
      ? `Недавний диалог:\n${historyBlock}\n\nНовое сообщение пользователя: "${message}"`
      : `Сообщение пользователя: "${message}"`;

    const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs?: number }> = [
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 750 },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    ];

    let responseText = '';
    let lastError: any = null;

    for (const candidate of modelCandidates) {
      if (candidate.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, candidate.delayMs));
      }
      try {
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: contentsPrompt,
          config: {
            thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isSeekingSupport: {
                  type: Type.BOOLEAN,
                  description: 'True if user shares negative emotion, stress, problem, or asks for emotional support.',
                },
                reply: {
                  type: Type.STRING,
                  description: 'Natural, lively cat response in Russian matching the requested personality mood.',
                },
              },
              required: ['isSeekingSupport', 'reply'],
            },
          },
        });
        responseText = (response.text || '').trim();
        if (responseText) break;
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || 0);
        const msg = String(err?.message || '');
        const isTransient =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          /DEADLINE_EXCEEDED|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|fetch failed/i.test(msg);
        if (!isTransient) {
          throw err;
        }
      }
    }

    if (!responseText) {
      throw lastError || new Error('Модель не вернула ответ');
    }

    let parsed: { isSeekingSupport?: boolean; reply?: string } = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { isSeekingSupport: false, reply: responseText };
    }

    const isSeekingSupport = Boolean(parsed.isSeekingSupport);
    const reply = parsed.reply?.trim() || 'Мяу! Я тут и слушаю тебя 🐾';

    return res.json({ isSeekingSupport, reply });
  } catch (err: any) {
    console.error('Gemini cat support error:', err);
    const status = Number(err?.status || 500);
    const rawMsg = String(err?.message || '');
    if (status === 400 || status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(rawMsg)) {
      return res.status(400).json({
        error: 'Проверь API-ключ Gemini в настройках Secrets или .env — сервер не смог авторизоваться.',
      });
    }
    if (status === 429 || status === 503 || status === 504 || /UNAVAILABLE|DEADLINE_EXCEEDED|high demand/i.test(rawMsg)) {
      return res.status(503).json({
        error: 'Котик сейчас чуть перегружен запросами — попробуй отправить сообщение ещё раз через пару секунд!',
      });
    }
    return res.status(500).json({
      error: 'Котик временно не смог ответить. Попробуй чуть позже.',
    });
  }
});

// AI Vision Board User Journey Generator (matches Excalidraw Vision Board workflow)
app.post('/api/vision-board', async (req: Request, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 1000) : '';
    if (!prompt) {
      return res.status(400).json({ error: 'Опиши идею или сценарий для доски' });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'API-ключ Gemini не настроен на сервере' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 14000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = [
      'Ты — продуктовый дизайнер. Разложи описание продукта или идеи пользователя в структуру доски «Главный путь пользователя» на русском языке.',
      'Сделай формулировки короткими, живыми, конкретными (для карточек на доске Excalidraw).',
      'Верни goalText (что нужно сделать, до 90 символов), startScreen (на каком экране стартует пользователь), 3 или 4 шага (screen, action, outcome), doneText (что получил пользователь и как он это понял), fallbackTrigger (что может пойти не так), fallbackRecovery (что покажет приложение и как продолжить), а также 4 кратких макета экранов (title, note).',
    ].join(' ');

    const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs?: number }> = [
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 750 },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    ];

    let responseText = '';
    let lastError: any = null;

    for (const candidate of modelCandidates) {
      if (candidate.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, candidate.delayMs));
      }
      try {
        const response = await ai.models.generateContent({
          model: candidate.model,
          contents: `Описание продукта или идеи: "${prompt}"`,
          config: {
            thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                boardTitle: { type: Type.STRING },
                goalText: { type: Type.STRING },
                startScreen: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      screen: { type: Type.STRING },
                      action: { type: Type.STRING },
                      outcome: { type: Type.STRING },
                    },
                    required: ['screen', 'action', 'outcome'],
                  },
                },
                doneText: { type: Type.STRING },
                fallbackTrigger: { type: Type.STRING },
                fallbackRecovery: { type: Type.STRING },
                mockups: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      note: { type: Type.STRING },
                    },
                    required: ['title', 'note'],
                  },
                },
              },
              required: ['goalText', 'startScreen', 'steps', 'doneText', 'fallbackTrigger', 'fallbackRecovery', 'mockups'],
            },
          },
        });
        responseText = (response.text || '').trim();
        if (responseText) break;
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || 0);
        const msg = String(err?.message || '');
        const isTransient =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          /DEADLINE_EXCEEDED|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|fetch failed/i.test(msg);
        if (!isTransient) throw err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Модель не вернула ответ');
    }

    const parsed = JSON.parse(responseText);
    return res.json({ board: parsed });
  } catch (err: any) {
    console.error('Gemini vision-board error:', err);
    const status = Number(err?.status || 500);
    if (status === 429 || status === 503 || status === 504) {
      return res.status(503).json({
        error: 'ИИ сейчас временно перегружен — попробуй ещё раз через пару секунд.',
      });
    }
    return res.status(500).json({
      error: 'Не удалось сгенерировать путь пользователя. Попробуй снова.',
    });
  }
});

// Windows Media (SMTC) Now-Playing Bridge
interface NowPlayingEntry {
  title: string;
  artist: string;
  source: string;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

const nowPlayingChannels = new Map<string, NowPlayingEntry>();

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [ch, entry] of nowPlayingChannels.entries()) {
    if (entry.updatedAt < cutoff) {
      nowPlayingChannels.delete(ch);
    }
  }
}, 5 * 60 * 1000);

function sanitizeMusicChannel(raw: unknown): string {
  const str = typeof raw === 'string' ? raw : '';
  return str.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'cosmo_default';
}

app.post('/api/music/now-playing', (req: Request, res: Response) => {
  const channel = sanitizeMusicChannel(req.body?.channel ?? req.query?.channel);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 160) : '';
  const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim().slice(0, 120) : '';
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 60) : 'Windows';
  const isPlaying = Boolean(req.body?.isPlaying);
  const rawPos = Number(req.body?.positionSec);
  const rawDur = Number(req.body?.durationSec);
  const durationSec = Number.isFinite(rawDur) && rawDur > 0 ? Math.min(86400, rawDur) : 0;
  let positionSec = Number.isFinite(rawPos) && rawPos > 0 ? rawPos : 0;
  if (durationSec > 0) {
    positionSec = Math.min(durationSec, positionSec);
  }

  nowPlayingChannels.set(channel, {
    title,
    artist,
    source: source || 'Windows',
    isPlaying,
    positionSec,
    durationSec,
    updatedAt: Date.now(),
  });

  return res.json({ ok: true });
});

app.get('/api/music/now-playing', (req: Request, res: Response) => {
  const channel = sanitizeMusicChannel(req.query?.channel);
  const entry = nowPlayingChannels.get(channel);

  if (!entry) {
    return res.json({
      connected: false,
      stale: true,
      title: '',
      artist: '',
      source: '',
      isPlaying: false,
      positionSec: 0,
      durationSec: 0,
      updatedAt: 0,
    });
  }

  const now = Date.now();
  const stale = now - entry.updatedAt > 15000;
  const elapsedSec = entry.isPlaying && !stale ? Math.max(0, (now - entry.updatedAt) / 1000) : 0;
  let livePositionSec = Math.max(0, entry.positionSec + elapsedSec);
  if (entry.durationSec > 0) {
    livePositionSec = Math.min(entry.durationSec, livePositionSec);
  }

  return res.json({
    connected: !stale,
    stale,
    title: entry.title,
    artist: entry.artist,
    source: entry.source,
    isPlaying: entry.isPlaying,
    positionSec: Number(livePositionSec.toFixed(2)),
    durationSec: Number(entry.durationSec.toFixed(2)),
    updatedAt: entry.updatedAt,
  });
});

app.get('/api/music/windows-script', (req: Request, res: Response) => {
  const channel = sanitizeMusicChannel(req.query?.channel);
  const rawOrigin = typeof req.query?.origin === 'string' ? req.query.origin.trim() : '';
  const safeOrigin = /^https?:\/\/[a-zA-Z0-9.:-]+$/.test(rawOrigin)
    ? rawOrigin.replace(/\/+$/, '')
    : `${req.protocol}://${req.get('host')}`;
  const endpoint = `${safeOrigin}/api/music/now-playing`;

  const psScript = `$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$channel = '${channel}'
$endpoint = '${endpoint}'

Write-Host ''
Write-Host '=== CosmoChat Windows Music Bridge (v2 + Timeline) ===' -ForegroundColor Cyan
Write-Host "Channel: $channel" -ForegroundColor DarkGray
Write-Host "Target:  $endpoint" -ForegroundColor DarkGray
Write-Host 'Watching Windows media player (SMTC track + position). Press Ctrl+C to stop.' -ForegroundColor Green
Write-Host ''

$useWinRt = $false
$manager = $null
$asTaskGeneric = $null
$propsType = $null

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
  })[0]
  $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
  $propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
  if ($asTaskGeneric -and $managerType -and $propsType) {
    $reqTask = $asTaskGeneric.MakeGenericMethod($managerType).Invoke($null, @($managerType::RequestAsync()))
    $reqTask.Wait(4000) | Out-Null
    $manager = $reqTask.Result
    if ($manager) { $useWinRt = $true }
  }
} catch {
  $useWinRt = $false
}

function Format-AppSource([string]$rawId) {
  if (-not $rawId) { return 'Windows' }
  $l = $rawId.ToLowerInvariant()
  if ($l -like '*spotify*') { return 'Spotify' }
  if ($l -like '*yandex*') { return 'Yandex Music' }
  if ($l -like '*msedge*') { return 'Edge' }
  if ($l -like '*chrome*') { return 'Chrome' }
  if ($l -like '*firefox*') { return 'Firefox' }
  if ($l -like '*aimp*') { return 'AIMP' }
  if ($l -like '*vlc*') { return 'VLC' }
  if ($l -like '*apple*') { return 'Apple Music' }
  if ($l -like '*telegram*') { return 'Telegram' }
  if ($l -like '*foobar*') { return 'foobar2000' }
  if ($l -like '*musicbee*') { return 'MusicBee' }
  $clean = ($rawId -split '!' | Select-Object -First 1) -replace '\\.exe$',''
  return $clean
}

function Format-Sec([double]$sec) {
  if ($sec -lt 0) { $sec = 0 }
  $t = [int][Math]::Floor($sec)
  $m = [int][Math]::Floor($t / 60)
  $s = $t % 60
  return ("{0}:{1:D2}" -f $m, $s)
}

$lastSig = ''
$lastPush = [DateTime]::MinValue
$lastSentPos = 0.0
$lastWasPlaying = $false

while ($true) {
  $title = ''
  $artist = ''
  $source = 'Windows'
  $isPlaying = $false
  $posSec = 0.0
  $durSec = 0.0

  if ($useWinRt -and $manager) {
    try {
      $session = $manager.GetCurrentSession()
      if ($session) {
        $info = $session.GetPlaybackInfo()
        $statusStr = ''
        if ($info) { $statusStr = $info.PlaybackStatus.ToString() }
        $isPlaying = ($statusStr -eq 'Playing')
        $source = Format-AppSource $session.SourceAppUserModelId
        $propTask = $asTaskGeneric.MakeGenericMethod($propsType).Invoke($null, @($session.TryGetMediaPropertiesAsync()))
        if ($propTask.Wait(2000)) {
          $props = $propTask.Result
          if ($props) {
            if ($props.Title) { $title = $props.Title.Trim() }
            if ($props.Artist) { $artist = $props.Artist.Trim() }
          }
        }
        try {
          $timeline = $session.GetTimelineProperties()
          if ($timeline) {
            $rawDur = ($timeline.EndTime - $timeline.StartTime).TotalSeconds
            $rawPos = ($timeline.Position - $timeline.StartTime).TotalSeconds
            if ($rawDur -gt 0 -and $rawDur -lt 86400) { $durSec = $rawDur }
            if ($rawPos -gt 0) { $posSec = $rawPos }
            if ($isPlaying -and $timeline.LastUpdatedTime -and $timeline.LastUpdatedTime.Year -gt 1970) {
              $drift = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime.ToUniversalTime()).TotalSeconds
              if ($drift -gt 0 -and $drift -lt 43200) {
                $posSec = $posSec + $drift
              }
            }
            if ($durSec -gt 0 -and $posSec -gt $durSec) { $posSec = $durSec }
            $posSec = [Math]::Round([Math]::Max(0, $posSec), 2)
            $durSec = [Math]::Round([Math]::Max(0, $durSec), 2)
          }
        } catch {}
      }
    } catch {}
  }

  if (-not $title) {
    $players = @('Spotify', 'YandexMusic', 'AIMP', 'foobar2000', 'vlc', 'MusicBee')
    foreach ($pname in $players) {
      $proc = Get-Process -Name $pname -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
      if ($proc) {
        $wt = $proc.MainWindowTitle.Trim()
        if ($wt -and $wt -notmatch '^(Spotify|Spotify Free|Spotify Premium|Yandex Music|AIMP|VLC media player|foobar2000|MusicBee)$') {
          $idx = $wt.IndexOf(' - ')
          if ($idx -gt 0) {
            $artist = $wt.Substring(0, $idx).Trim()
            $title = $wt.Substring($idx + 3).Trim()
          } else {
            $title = $wt
            $artist = $pname
          }
          $source = Format-AppSource $pname
          $isPlaying = $true
          break
        }
      }
    }
  }

  $durRounded = [int][Math]::Round($durSec)
  $sig = "$title|$artist|$source|$isPlaying|$durRounded"
  $elapsed = ([DateTime]::UtcNow - $lastPush).TotalSeconds
  $expectedPos = $lastSentPos
  if ($lastWasPlaying -and $elapsed -gt 0 -and $elapsed -lt 3600) {
    $expectedPos = $lastSentPos + $elapsed
  }
  $seekDetected = ($durSec -gt 0 -and [Math]::Abs($posSec - $expectedPos) -ge 1.8)

  if ($sig -ne $lastSig -or $seekDetected -or $elapsed -ge 3) {
    try {
      $payload = @{
        channel = $channel
        title = $title
        artist = $artist
        source = $source
        isPlaying = $isPlaying
        positionSec = $posSec
        durationSec = $durSec
      } | ConvertTo-Json -Compress
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
      Invoke-RestMethod -Uri $endpoint -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 5 | Out-Null
      $lastPush = [DateTime]::UtcNow
      $lastSentPos = $posSec
      $lastWasPlaying = $isPlaying
      if ($sig -ne $lastSig -or $seekDetected) {
        $lastSig = $sig
        if ($title) {
          $stateMark = if ($isPlaying) { 'PLAY' } else { 'PAUSE' }
          $timePart = if ($durSec -gt 0) { " [" + (Format-Sec $posSec) + " / " + (Format-Sec $durSec) + "]" } else { "" }
          Write-Host ("[{0}] {1} - {2} ({3}){4}" -f $stateMark, $artist, $title, $source, $timePart) -ForegroundColor Cyan
        } else {
          Write-Host '[IDLE] No active media session' -ForegroundColor DarkYellow
        }
      }
    } catch {
      Write-Host 'Connection retry...' -ForegroundColor DarkRed
    }
  }

  Start-Sleep -Milliseconds 1000
}
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(psScript);
});

// Live YouTube Music Cache (60s TTL)
const ytSearchCache = new Map<string, { tracks: YouTubeTrack[]; expiresAt: number }>();

// Real YouTube Music Catalog & Search
app.get('/api/music/youtube/tracks', async (req: Request, res: Response) => {
  const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const genre = typeof req.query?.genre === 'string' ? req.query.genre.trim() : 'all';
  const cacheKey = `${genre}::${query.toLowerCase()}`;

  const cached = ytSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ tracks: cached.tracks, source: 'youtube_music_live', cached: true });
  }

  try {
    const tracks = await searchRealYouTubeMusic(query, genre);
    ytSearchCache.set(cacheKey, { tracks, expiresAt: Date.now() + 60_000 });
    return res.json({ tracks, source: 'youtube_music_live', cached: false });
  } catch (err: any) {
    console.error('YouTube Music search error:', err?.message || err);
    return res.status(502).json({
      error: 'Не удалось получить данные из YouTube Music',
      tracks: []
    });
  }
});

// Detect client region / IP country headers
app.get('/api/music/youtube/client-status', (req: Request, res: Response) => {
  const rawCountry =
    (req.headers['cf-ipcountry'] as string) ||
    (req.headers['x-appengine-country'] as string) ||
    (req.headers['x-vercel-ip-country'] as string) ||
    (req.headers['x-country-code'] as string) ||
    '';
  const countryCode = rawCountry.trim().toUpperCase();
  const isRussiaIp = countryCode === 'RU';
  return res.json({
    countryCode,
    isRussiaIp
  });
});

// YouTube Music Region & VPN Access Validation
app.get('/api/music/youtube/check-access', (req: Request, res: Response) => {
  const region = (typeof req.query?.region === 'string' ? req.query.region : 'RU_NO_VPN') as any;
  const isVpn = req.query?.vpn === 'true' || req.query?.vpn === '1';
  const youtubeAccess = req.query?.access === 'restricted' ? 'restricted' : 'available';

  const check = checkContactYouTubeAccess({
    region: isVpn ? 'RU_WITH_VPN' : region,
    isVpnActive: isVpn,
    youtubeAccess
  });

  return res.json(check);
});

// Downloadable Windows PE32+ (.exe) Desktop Launcher for CosmoChat
app.get('/api/download/cosmochat.exe', (req: Request, res: Response) => {
  try {
    const targetUrl = sanitizeExeTargetUrl(req.query?.target);
    let iconPng: Buffer | undefined;
    const candidateIconPaths = [
      path.resolve(__dirname, 'public/pwa-192x192.png'),
      path.resolve(__dirname, 'dist/pwa-192x192.png'),
    ];
    for (const candidate of candidateIconPaths) {
      if (fs.existsSync(candidate)) {
        iconPng = fs.readFileSync(candidate);
        break;
      }
    }

    const exeBuffer = buildCosmoChatWindowsExe({ targetUrl, iconPng });
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Disposition', 'attachment; filename="CosmoChat.exe"');
    res.setHeader('Content-Length', String(exeBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.send(exeBuffer);
  } catch (err: any) {
    console.error('Error building CosmoChat.exe:', err);
    return res.status(500).json({ error: 'Не удалось собрать CosmoChat.exe' });
  }
});

// Downloadable Android (.apk) Package for CosmoChat
app.get('/api/download/cosmochat.apk', (req: Request, res: Response) => {
  try {
    const targetUrl = sanitizeExeTargetUrl(req.query?.target);
    let iconPng: Buffer | undefined;
    const candidateIconPaths = [
      path.resolve(__dirname, 'public/pwa-192x192.png'),
      path.resolve(__dirname, 'dist/pwa-192x192.png'),
    ];
    for (const candidate of candidateIconPaths) {
      if (fs.existsSync(candidate)) {
        iconPng = fs.readFileSync(candidate);
        break;
      }
    }

    const apkBuffer = buildCosmoChatAndroidApk({ targetUrl, iconPng });
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="CosmoChat.apk"');
    res.setHeader('Content-Length', String(apkBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.send(apkBuffer);
  } catch (err: any) {
    console.error('Error building CosmoChat.apk:', err);
    return res.status(500).json({ error: 'Не удалось собрать CosmoChat.apk' });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const httpServer = http.createServer(app);

  if (isDev) {
    // Cleanup handler for browsers that previously installed vite-plugin-pwa's dev-sw.js
    app.get('/dev-sw.js', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(`self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch {}
  })());
});
`);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CosmoChat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
