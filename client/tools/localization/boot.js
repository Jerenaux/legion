// This small, independent bundle still works when the main game bundle fails.
(() => {
  const locales = __LEGION_LOCALES__;
  let saved;
  try { saved = localStorage.getItem('legion.language'); } catch { /* Storage disabled. */ }
  const resolveLocale = __RESOLVE_LOCALE__;
  const selected = resolveLocale([saved, ...(navigator.languages || [navigator.language])], Object.keys(locales).map(code => ({code})));
  document.documentElement.lang = selected;
  document.documentElement.dir = locales[selected].direction;
  for (const element of document.querySelectorAll('[data-startup-message]')) {
    const key = element.getAttribute('data-startup-message');
    element.textContent = locales[selected].messages[key] || locales.en.messages[key];
  }
})();
