import {h} from 'preact';
import {useState} from 'preact/hooks';
import {language, locales, selectLanguage, languageChangeBlocked, t, userError} from '../i18n/core';
import './LanguageSelect.css';

export default function LanguageSelect() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const blocked = languageChangeBlocked(location.pathname);
  const change = async (picker: HTMLSelectElement) => {
    const code = picker.value;
    const focused = document.activeElement === picker;
    setPending(code);
    setError(false);
    try { await selectLanguage(code); }
    catch { setError(true); }
    finally {
      setPending(null);
      requestAnimationFrame(() => {
        if (focused && picker.isConnected && document.activeElement === document.body) picker.focus();
      });
    }
  };
  return <div className="language-select">
    <label>
      {t('Language')}
      <select value={pending ?? language} disabled={blocked || pending !== null} aria-busy={pending !== null} onChange={event => void change(event.currentTarget)}>
        {locales.map(locale => <option key={locale.code} value={locale.code} lang={locale.code} style={{fontFamily: locale.fontFamily}}>{locale.name}</option>)}
      </select>
    </label>
    {blocked && <small>{t('Return to the main menu to change language.')}</small>}
    {error && <small role="alert">{userError(null)}</small>}
  </div>;
}
