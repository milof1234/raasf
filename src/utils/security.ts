export function cleanDigits(str: string): string {
  const digits = (str || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isAdminPhone(phone: string): boolean {
  return cleanDigits(phone) === '9254699801';
}

export function normalizeStr(str: string | null | undefined): string {
  return (str || '').toString().toLowerCase().replace(/[\s()\-+@_]/g, '');
}

export function applyPhoneMask(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("7") || digits.startsWith("8")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  let formatted = "+7";
  if (digits.length > 0) {
    formatted += " (" + digits.slice(0, 3);
  }
  if (digits.length >= 3) {
    formatted += ") " + digits.slice(3, 6);
  }
  if (digits.length >= 6) {
    formatted += "-" + digits.slice(6, 8);
  }
  if (digits.length >= 8) {
    formatted += "-" + digits.slice(8, 10);
  }
  return formatted;
}

const CYRILLIC_PROFANITY_PATTERNS: RegExp[] = [
  /х[уиюя][йилнчтс]/i,
  /х[уи][её][встмлпб]/i,
  /(?:^|[^а-я])х[уи][йяеи](?:$|[^а-я])/i,
  /(?:на|по|за|не|о|а)х[уи][йеия]/i,
  /охуе/i,
  /ахуе/i,
  /(?:^|[^а-я])хер(?:ня|овин|ота|ню|ли|$|[^а-я])/i,
  /(?:на|по)хер/i,
  /пизд/i,
  /пздц/i,
  /еб(?:ан|ат|аш|ал|лан|ло|уч|ут|ист|ну|ыр|ало|ик)/i,
  /(?:у|вы|за|на|от|по|под|про|раз|с|до|пере|при)ъ?еб(?:а|и|у|н|к|о|л|ш|с|$)/i,
  /долбоеб/i,
  /(?:^|[^а-я])бля(?:д|т|х|с|ть|ди|до|ду|ц|дств|$)/i,
  /бляд/i,
  /бл[яи]т[ьъ]?/i,
  /сук[аиоуе]/i,
  /суч(?:к[аиуе]|ар|он)/i,
  /муд(?:ак|ач|ил|озвон|ищ)/i,
  /г[ао]нд[оа]н/i,
  /пид[аое]?р/i,
  /педик/i,
  /шлюх/i,
  /шлюш/i,
  /шалав/i,
  /залуп/i,
  /манд(?:а|ы|у|е|ой)/i,
  /дроч/i,
  /говн/i,
  /жоп[аыуео]/i,
  /дебил/i,
  /даун(?![а-я]*шифт)/i,
  /мраз[ьот]/i,
  /ублюд/i,
  /гнид[аыуе]/i,
  /(?:^|[^а-я])чмо(?:шник|р|$|[^а-я])/i,
  /твар[ьию]/i,
  /сволоч/i,
];

const LATIN_PROFANITY_PATTERNS: RegExp[] = [
  /f+u+c*k+/i,
  /f+c+k+/i,
  /s+h+i+t+/i,
  /b+i+t+c+h+/i,
  /(?<![a-z])c+u+n+t+/i,
  /d+i+c+k+(?:h+e+a+d+|s+u+c+k+)?/i,
  /(?<![a-z])c+o+c+k+(?![a-z])|c+o+c+k+s+u+c+k+/i,
  /p+u+s+s+y+/i,
  /a+s+s+h+o+l+e+/i,
  /w+h+o+r+e+/i,
  /(?<![a-z])s+l+u+t+/i,
  /n+i+g+g+(?:e+r+|a+)/i,
  /f+a+g+g*o*t*/i,
  /b+a+s+t+a+r+d+/i,
  // Common Russian profanity transliterations (including variations)
  /b+l+y+a+[dt]?/i,
  /b+l+j+a+[dt]?/i,
  /b+l+i+a+[dt]+/i,
  /[sc]+u+k+[aiou]/i,
  /[sc]+y+k+[aiou]/i,
  /s+u+c+h+k+[ai]/i,
  /p+[i1]+z+d+/i,
  /p+z+d+c+/i,
  /(?:k+h+|x+|h+)[u]+(?:y+|i+|j+)[a-z0-9]*/i,
  /x+y+(?:i+|u+|y+)/i,
  /(?:n+a+|p+o+|z+a+|o+)(?:k+h+|x+|h+)[u]+(?:y+|i+)/i,
  /y*e+b+(?:a+n+|a+t+|a+l+|l+a+n+|n+u+t+|u+c+h+)/i,
  /(?:u+|z+a+|v+y+|n+a+|d+o+l+b+o+)y*e+b+/i,
  /p+[i1]+d+[aoe]*r+/i,
  /p+e+d+[i1]+k+/i,
  /m+u+d+a+k+/i,
  /g+[ao]+n+d+o+n+/i,
  /s+h+l+(?:y+u+|u+)[hk]+/i,
  /s+h+a+l+a+v+/i,
  /z+a+l+u+p+/i,
  /d+r+o+c+h+/i,
  /g+o+v+n+/i,
  /(?:z+h+|j+)o+p+[aouy]/i,
  /u+b+l+(?:y+u+|u+)d+/i,
  /m+r+a+z+/i,
  /d+e+b+[i1]+l+/i,
  /(?<![a-z])c+h+m+o+/i,
];

const HOMOGLYPH_TO_CYRILLIC: Record<string, string> = {
  '0': 'о',
  '1': 'и',
  '3': 'з',
  '4': 'ч',
  '5': 'с',
  '6': 'б',
  '7': 'т',
  '8': 'в',
  '@': 'а',
  '$': 'с',
  a: 'а',
  b: 'б',
  c: 'с',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'х',
  y: 'у',
  z: 'з',
};

const TRANSLIT_DIGRAPHS: Array<[RegExp, string]> = [
  [/shch|sch/g, 'щ'],
  [/zh/g, 'ж'],
  [/kh/g, 'х'],
  [/ch/g, 'ч'],
  [/sh/g, 'ш'],
  [/ts|tc/g, 'ц'],
  [/ya|ja/g, 'я'],
  [/yu|ju/g, 'ю'],
  [/ye|je/g, 'е'],
  [/yo|jo/g, 'е'],
  [/ia/g, 'я'],
];

const TRANSLIT_SINGLE: Record<string, string> = {
  ...HOMOGLYPH_TO_CYRILLIC,
  c: 'ц',
  j: 'й',
};

function mapChars(text: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of text) {
    out += table[ch] ?? ch;
  }
  return out;
}

function translitLatinToCyrillic(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TRANSLIT_DIGRAPHS) {
    result = result.replace(pattern, replacement);
  }
  return mapChars(result, TRANSLIT_SINGLE);
}

function collapseSeparators(text: string): string {
  return text.replace(/[\s_\-.,!@#$%^&*()+=[\]{};:'"|\\/<>?~`]+/g, '');
}

function collapseRepeatedLetters(text: string): string {
  return text.replace(/(.)\1+/g, '$1');
}

export function containsProfanity(input: string): boolean {
  if (!input) return false;
  const raw = String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е');

  const rawCollapsed = collapseSeparators(raw);
  const rawDeduped = collapseRepeatedLetters(rawCollapsed);

  const latinCandidates = [
    raw,
    rawCollapsed,
    rawDeduped,
  ];
  if (LATIN_PROFANITY_PATTERNS.some((p) => latinCandidates.some((c) => p.test(c)))) {
    return true;
  }

  const homoglyphRaw = mapChars(raw, HOMOGLYPH_TO_CYRILLIC);
  const homoglyphCollapsed = collapseSeparators(homoglyphRaw);
  const homoglyphDeduped = collapseRepeatedLetters(homoglyphCollapsed);

  const translitRaw = translitLatinToCyrillic(raw);
  const translitCollapsed = collapseSeparators(translitRaw);
  const translitDeduped = collapseRepeatedLetters(translitCollapsed);

  const cyrillicCandidates = [
    raw,
    rawCollapsed,
    homoglyphRaw,
    homoglyphCollapsed,
    homoglyphDeduped,
    translitRaw,
    translitCollapsed,
    translitDeduped,
  ].map((c) =>
    c.replace(/(?:у?потре|оскор|истре|осла|углу|заглу|приспосо|раздро|обосо|погу|загу|возлю)бл[яе]т[ьи]?/g, ' ')
  );

  return CYRILLIC_PROFANITY_PATTERNS.some((p) => cyrillicCandidates.some((c) => p.test(c)));
}

// Synchronous fast hash for passwords with salt (client & tests)
export function hashPassword(password: string, salt: string = 'cosmo_salt_2026'): string {
  let hash = 0;
  const str = salt + ':' + password;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(16) + '_' + str.length;
}

export function formatLastSeen(timestamp?: number, isOnline?: boolean): { text: string; isOnline: boolean } {
  if (isOnline) {
    return { text: 'в сети', isOnline: true };
  }
  if (!timestamp) {
    return { text: 'был(а) недавно', isOnline: false };
  }

  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return { text: 'был(а) только что', isOnline: false };
  if (diffMin < 60) return { text: `был(а) ${diffMin} мин. назад`, isOnline: false };

  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffMin < 1440) return { text: `был(а) сегодня в ${time}`, isOnline: false };

  const date = new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
  return { text: `был(а) ${date} в ${time}`, isOnline: false };
}
