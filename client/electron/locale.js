// Shared by the renderer, native dialogs and the independent startup fallback.
function resolveLocale(preferences, locales) {
  for (const preference of preferences) {
    if (typeof preference !== 'string' || !preference) continue;
    const steam = locales.find(locale => locale.steamLanguages?.includes(preference.toLowerCase()));
    if (steam) return steam.code;
    try {
      const requested = new Intl.Locale(preference).maximize();
      const exact = locales.find(locale => locale.code.toLowerCase() === preference.toLowerCase());
      const related = locales.find(locale => {
        const candidate = new Intl.Locale(locale.code).maximize();
        return candidate.language === requested.language && candidate.script === requested.script;
      });
      if (exact || related) return (exact || related).code;
    } catch { /* Ignore invalid saved/browser tags. */ }
  }
  return 'en';
}
module.exports = {resolveLocale};
