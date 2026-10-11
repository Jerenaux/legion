// Languages the invite page supports (the game's shipped catalogs) and how a page picks one.
// Kept free of the catalogs themselves so the operator CLIs can validate languages cheaply.

export const INVITE_LANGUAGES = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'pt-PT', 'ru', 'zh-Hans', 'zh-Hant'] as const;
export type InviteLanguage = typeof INVITE_LANGUAGES[number];

/** Matches a requested tag (`fr`, `pt`, `zh-TW`, `pt-BR`…) to a shipped language, or null. */
export function matchInviteLanguage(tag: unknown): InviteLanguage | null {
  if (typeof tag !== 'string' || !tag.trim()) return null;
  const exact = INVITE_LANGUAGES.find(code => code.toLowerCase() === tag.trim().toLowerCase());
  if (exact) return exact;
  try {
    const requested = new Intl.Locale(tag.trim()).maximize();
    const related = INVITE_LANGUAGES.find(code => {
      const candidate = new Intl.Locale(code).maximize();
      return candidate.language === requested.language && candidate.script === requested.script;
    });
    return related ?? null;
  } catch { return null; }
}

/** `?lang=` wins, then the community/gift language, then the browser's languages, then English. */
export function pickInviteLanguage(query: unknown, preferred: unknown, acceptLanguage: unknown): InviteLanguage {
  const browser = typeof acceptLanguage === 'string'
    ? acceptLanguage.split(',').map(part => {
      const [tag, ...params] = part.trim().split(';');
      const quality = Number(params.find(param => param.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return {tag, quality: Number.isFinite(quality) ? quality : 0};
    }).filter(entry => entry.tag && entry.quality > 0).sort((a, b) => b.quality - a.quality).map(entry => entry.tag)
    : [];
  for (const candidate of [query, preferred, ...browser]) {
    const match = matchInviteLanguage(candidate);
    if (match) return match;
  }
  return 'en';
}

