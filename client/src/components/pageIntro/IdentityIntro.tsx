import {h} from 'preact';
import {useContext, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {t, userError} from '../../i18n/core';
import {MAX_AVATAR_ID, MAX_NICKNAME_LENGTH} from '@legion/shared/config';
import {PlayerContext} from '../../contexts/PlayerContext';
import {apiFetch} from '../../services/apiService';
import {avatarContext} from '../utils';
import {markPageIntroSeen} from './PageIntro';
import './PageIntro.css';

const avatarURL = (id: string) => { try { return avatarContext(`./${id}.png`); } catch { return ''; } };

/**
 * After the first match: show the generated nickname and avatar, and let the player change
 * them here (or later from their profile). Closing without changes keeps them.
 */
export default function IdentityIntro({onClose}: {onClose: () => void}) {
  const {player, setPlayerInfo} = useContext(PlayerContext);
  const [name, setName] = useState(player.name || '');
  const [avatar, setAvatar] = useState(player.avatar || '1');
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const trimmed = name.trim();
  const changed = trimmed !== player.name || avatar !== player.avatar;

  const close = () => {
    markPageIntroSeen('identity', player.uid);
    onClose();
  };

  const save = async (event: Event) => {
    event.preventDefault();
    if (!changed) { close(); return; }
    if (!trimmed) { setError(t('Choose a name.')); return; }
    setSaving(true);
    setError('');
    try {
      if (avatar !== player.avatar) {
        await apiFetch('updatePlayerAvatar', {method: 'POST', body: {avatarId: avatar}});
        setPlayerInfo({avatar});
      }
      if (trimmed !== player.name) {
        await apiFetch('updatePlayerName', {method: 'POST', body: {name: trimmed}});
        setPlayerInfo({name: trimmed});
      }
      close();
    } catch (failure) {
      setError(String((failure as Error)?.message).includes('profane') ? t('Name contains profane words') : userError(failure));
      setSaving(false);
    }
  };

  return <Modal isOpen onRequestClose={saving ? undefined : close} contentLabel={t('Your name and portrait')}
    className="page-intro page-intro--identity" overlayClassName="page-intro-overlay">
    <form onSubmit={save}>
      <h2>{t('Your name and portrait')}</h2>
      <p className="page-intro-text">{t('Other players see them in matches and on leaderboards. We picked these for you; keep them or make them yours.')}</p>
      <div className="identity-card">
        <button type="button" className="identity-avatar" aria-expanded={choosing} aria-controls="identity-avatars"
          onClick={() => setChoosing(!choosing)} style={{backgroundImage: `url(${avatarURL(avatar)})`}}>
          <span>{t('Change')}</span>
        </button>
        <label className="identity-name">
          <span>{t('Name')}</span>
          <input value={name} maxLength={MAX_NICKNAME_LENGTH} autoComplete="off" spellcheck={false}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'identity-error' : undefined}
            onInput={event => { setName((event.target as HTMLInputElement).value); setError(''); }} />
        </label>
      </div>
      {choosing && <fieldset id="identity-avatars" className="identity-avatars">
        <legend className="visually-hidden">{t('Choose your Avatar')}</legend>
        {Array.from({length: MAX_AVATAR_ID}, (_, index) => String(index + 1)).map(id =>
          <button type="button" key={id} aria-pressed={id === avatar} aria-label={t('Avatar {{value0}}', {value0: id})}
            className={id === avatar ? 'is-selected' : ''} style={{backgroundImage: `url(${avatarURL(id)})`}}
            onClick={() => { setAvatar(id); setChoosing(false); }} />)}
      </fieldset>}
      {error && <p id="identity-error" className="identity-error" role="alert">{error}</p>}
      <p className="page-intro-text identity-hint">{t('You can change both any time from your profile: select your portrait at the top left.')}</p>
      <div className="page-intro-actions">
        <button type="button" className="page-intro-secondary" data-desktop-cancel disabled={saving} onClick={close}>{t('Skip')}</button>
        <button type="submit" className="page-intro-primary" disabled={saving}>{changed ? t('Save') : t('Keep them')}</button>
      </div>
    </form>
  </Modal>;
}
