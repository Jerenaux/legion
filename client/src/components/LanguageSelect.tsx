import {h, Fragment} from 'preact';
import {useState} from 'preact/hooks';
import {language, locales, selectLanguage, t} from '../i18n/core';
import './LanguageSelect.css';

export default function LanguageSelect() {
  const [selected, setSelected] = useState(language);
  const blocked = /^\/(game|replay|queue|lobby)(\/|$)/.test(location.pathname);
  return <div className="language-select">
    <label>
      {t('Language')}
      <select value={selected} disabled={blocked} onChange={event => setSelected(event.currentTarget.value)}>
        {locales.map(locale => <option key={locale.code} value={locale.code} lang={locale.code} style={{fontFamily: locale.fontFamily}}>{locale.name}</option>)}
      </select>
    </label>
    {blocked ? <small>{t('Return to the main menu to change language.')}</small> : selected !== language && <>
      <small>{t('Changing language reloads the game.')}</small>
      <button type="button" onClick={() => selectLanguage(selected)}>{t('Apply language')}</button>
    </>}
  </div>;
}
