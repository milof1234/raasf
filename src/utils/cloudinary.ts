/**
 * Cloudinary Media & URL Optimization Utility for CosmoChat
 * Automatically injects best-practice transformations (f_auto, q_auto, g_face, c_fill, responsive widths)
 * and provides seamless media uploading via the server-side Cloudinary pipeline.
 */

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'limit' | 'fit' | 'thumb' | 'scale';
  gravity?: 'face' | 'auto' | 'center';
  quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low' | number;
  format?: 'auto' | 'webp' | 'avif' | 'png' | 'jpg';
  dpr?: 'auto' | number;
  blur?: number;
}

/**
 * Checks whether a URL is hosted on Cloudinary
 */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/**
 * Injects on-the-fly Cloudinary transformations into an image URL.
 * If URL is not on Cloudinary, returns the URL unchanged.
 */
export function buildCloudinaryUrl(
  url: string | null | undefined,
  options: CloudinaryTransformOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';
  if (!isCloudinaryUrl(url)) return url;

  const {
    width,
    height,
    crop = width && height ? 'fill' : 'limit',
    gravity,
    quality = 'auto',
    format = 'auto',
    dpr = 'auto',
    blur
  } = options;

  // Build transformation string segments
  const parts: string[] = [];

  if (format) parts.push(`f_${format}`);
  if (quality) parts.push(`q_${quality}`);
  if (dpr) parts.push(`dpr_${dpr}`);
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (crop && (width || height)) parts.push(`c_${crop}`);
  if (gravity) parts.push(`g_${gravity}`);
  if (blur) parts.push(`e_blur:${blur}`);

  if (parts.length === 0) return url;

  const transformString = parts.join(',');

  // Insert transformations right after /image/upload/ or /video/upload/
  const uploadMarker = '/upload/';
  const uploadIdx = url.indexOf(uploadMarker);

  if (uploadIdx === -1) return url;

  const prefix = url.substring(0, uploadIdx + uploadMarker.length);
  const suffix = url.substring(uploadIdx + uploadMarker.length);

  // If suffix already has transformations (starts with something like "w_300,h_300/"), replace or prepend
  if (suffix.startsWith('v') && /v\d+\//.test(suffix)) {
    // Normal format: /upload/v12345/sample.jpg -> /upload/f_auto,q_auto/v12345/sample.jpg
    return `${prefix}${transformString}/${suffix}`;
  } else if (suffix.includes('/')) {
    // Already has some transformation before version: check if it's transform or version
    const firstSlash = suffix.indexOf('/');
    const firstSegment = suffix.substring(0, firstSlash);
    if (/^[a-z]_[a-z0-9:,_-]+$/i.test(firstSegment)) {
      // Replace existing transformation
      return `${prefix}${transformString}/${suffix.substring(firstSlash + 1)}`;
    }
    return `${prefix}${transformString}/${suffix}`;
  }

  return `${prefix}${transformString}/${suffix}`;
}

/**
 * Returns an optimized Avatar URL with smart facial centering (g_face)
 * and auto-format (f_auto, q_auto)
 */
export function getOptimizedAvatarUrl(avatarUrl: string | null | undefined, size = 96): string {
  if (!avatarUrl) return '';
  return buildCloudinaryUrl(avatarUrl, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto'
  });
}

/**
 * Returns an optimized chat image URL with responsive bounds and compression
 */
export function getOptimizedChatImageUrl(imageUrl: string | null | undefined, maxWidth = 800): string {
  if (!imageUrl) return '';
  return buildCloudinaryUrl(imageUrl, {
    width: maxWidth,
    crop: 'limit',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto'
  });
}

/**
 * Returns a lightweight preview thumbnail for chat bubbles
 */
export function getOptimizedThumbnailUrl(imageUrl: string | null | undefined, width = 360): string {
  if (!imageUrl) return '';
  return buildCloudinaryUrl(imageUrl, {
    width,
    crop: 'limit',
    quality: 'auto:eco',
    format: 'auto'
  });
}

/**
 * Returns optimized wallpaper/background URL
 */
export function getOptimizedWallpaperUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';
  return buildCloudinaryUrl(imageUrl, {
    width: 1200,
    crop: 'limit',
    quality: 'auto:good',
    format: 'auto'
  });
}

export interface UploadResult {
  url: string;
  secure_url: string;
  public_id?: string;
  isCloudinary: boolean;
  bytes?: number;
  format?: string;
}

/**
 * Pre-compresses client image on canvas before upload to drastically cut upload times and bandwidth
 */
export async function precompressImage(fileOrDataUrl: File | string, maxDimension = 1400): Promise<string> {
  return new Promise((resolve) => {
    const handleLoadedImage = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Prefer webp if supported, otherwise jpeg
        resolve(canvas.toDataURL('image/webp', 0.88));
      } else {
        resolve(img.src);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      const img = new Image();
      img.onload = () => handleLoadedImage(img);
      img.onerror = () => resolve(fileOrDataUrl);
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => handleLoadedImage(img);
        img.onerror = () => resolve(e.target?.result as string || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Uploads media (File or base64) to the Cloudinary backend pipeline
 */
export async function uploadMediaToCloudinary(
  fileOrBase64: File | string,
  folder: 'avatars' | 'chat_images' | 'wallpapers' = 'chat_images'
): Promise<UploadResult> {
  try {
    // 1. Client-side precompression for lightning speed
    const compressedDataUrl = await precompressImage(
      fileOrBase64,
      folder === 'avatars' ? 400 : 1400
    );

    // 2. Upload to Cloudinary API endpoint
    const response = await fetch('/api/cloudinary/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: compressedDataUrl,
        folder
      })
    });

    if (!response.ok) {
      console.warn('Server upload returned non-200, falling back to local optimized image');
      return {
        url: compressedDataUrl,
        secure_url: compressedDataUrl,
        isCloudinary: false
      };
    }

    const data = await response.json();
    return {
      url: data.secure_url || data.url || compressedDataUrl,
      secure_url: data.secure_url || data.url || compressedDataUrl,
      public_id: data.public_id,
      isCloudinary: !!data.cloudinary,
      bytes: data.bytes,
      format: data.format
    };
  } catch (err) {
    console.warn('Network error uploading to Cloudinary, using offline compressed copy:', err);
    const fallback = typeof fileOrBase64 === 'string' ? fileOrBase64 : '';
    return {
      url: fallback,
      secure_url: fallback,
      isCloudinary: false
    };
  }
}

/**
 * Fetches current Cloudinary configuration status from server
 */
export async function fetchCloudinaryStatus(): Promise<{
  configured: boolean;
  cloudName: string;
  features: string[];
}> {
  try {
    const res = await fetch('/api/cloudinary/status');
    if (!res.ok) throw new Error('Status error');
    return await res.json();
  } catch {
    return {
      configured: false,
      cloudName: 'cosmochat-cloud',
      features: ['f_auto', 'q_auto', 'g_face', 'CDN']
    };
  }
}
