// Shared by the renderer, native dialogs and the independent startup fallback.
function resolveLocale(preferences, locales) {
  for (const preference of preferences) {
    if (!preference) continue;
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
