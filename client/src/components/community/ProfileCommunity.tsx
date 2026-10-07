import {h} from 'preact';
import {useState} from 'preact/hooks';
import {Link} from 'preact-router/match';
import {normalizeCommunityCode, type CommunitySummary} from '@legion/shared/communities';
import {t, i18n} from '../../i18n/core';
import Sigil from '../sigil/Sigil';
import JoinCommunityDialog from './JoinCommunityDialog';
import './community.style.css';

interface Props {
  community: CommunitySummary | null | undefined;
  joinedAt?: number | null;
  /** Shows the code entry when the viewed profile is the player's own and has no community. */
  isOwn: boolean;
}

export default function ProfileCommunity({community, joinedAt, isOwn}: Props) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  if (community) {
    return <Link href={`/community/${community.id}`} className="profile-community">
      <Sigil sigil={community.sigil} size={64} />
      <span className="profile-community-text">
        <span className="profile-community-name">{community.name} <span className="community-tag-chip">{community.tag}</span></span>
        {joinedAt && <span className="profile-community-since">{t('Joined {{value0}}', {value0: new Date(joinedAt).toLocaleDateString(i18n.resolvedLanguage, {year: 'numeric', month: 'long', day: 'numeric'})})}</span>}
      </span>
    </Link>;
  }
  if (!isOwn) return null;

  const submit = (event: Event) => {
    event.preventDefault();
    const id = normalizeCommunityCode(code);
    setInvalid(!id);
    if (id) setPending(id);
  };

  return <form className="profile-community profile-community-join" onSubmit={submit}>
    <svg className="profile-community-empty" viewBox="0 0 32 36" width={57} height={64} aria-hidden="true"><path d="M7 2h18l5 5v20L16 34 2 27V7Z" /></svg>
    <span className="profile-community-text">
      <label htmlFor="community-code" className="profile-community-name">{t('Join a community')}</label>
      <span className="profile-community-entry">
        <input id="community-code" value={code} maxLength={24} autoComplete="off" spellcheck={false}
          placeholder={t('Creator code')} aria-invalid={invalid} aria-describedby={invalid ? 'community-code-error' : undefined}
          onInput={event => { setCode((event.target as HTMLInputElement).value); setInvalid(false); }} />
        <button type="submit" disabled={!code.trim()}>{t('Join')}</button>
      </span>
      {invalid && <span id="community-code-error" className="profile-community-error">{t('Codes are 3–24 letters, digits or hyphens.')}</span>}
    </span>
    {pending && <JoinCommunityDialog code={pending} via="code" onClose={() => { setPending(null); setCode(''); }} />}
  </form>;
}
