import {h} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import {Link} from 'preact-router/match';
import type {CommunitySummary} from '@legion/shared/communities';
import {PlayerContext} from '../../contexts/PlayerContext';
import {apiFetch} from '../../services/apiService';
import {t, i18n, formatNumber} from '../../i18n/core';
import {getLeagueIcon, loadAvatar} from '../utils';
import Ghost from '../ghost/Ghost';
import Sigil from '../sigil/Sigil';
import './community.style.css';

interface CommunityDetails extends CommunitySummary {
  members: number;
  createdAt: number | null;
  seasonEnd: number;
  season: {wins: number; games: number; rank: number | null};
  topMembers: {id: string; name: string; avatar: string; elo: number; league: number; weeklyWins: number}[];
}

export const weekEndLabel = (seconds: number) => new Date(Date.now() + seconds * 1000)
  .toLocaleString(i18n.resolvedLanguage, {weekday: 'long', hour: '2-digit', minute: '2-digit'});

export default function CommunityPage({id}: {id?: string}) {
  const {player} = useContext(PlayerContext);
  const [details, setDetails] = useState<CommunityDetails | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState('loading');
    apiFetch(`getCommunity?id=${encodeURIComponent(id || '')}`, {}, 2)
      .then(data => { if (live) { setDetails(data); setState('ready'); } })
      .catch(error => { if (live) setState([400, 404].includes(error?.status) ? 'missing' : 'failed'); });
    return () => { live = false; };
  }, [id, attempt]);

  if (state === 'loading') return <div className="community-page" aria-busy="true">
    <Ghost height={168} />
    <Ghost height={48} count={6} className="community-ghost-rows" />
  </div>;
  if (state !== 'ready' || !details) return <div className="community-page">
    <section className="rank-load-error" role="alert">
      <h2>{t(state === 'missing' ? 'Community not found' : 'Community couldn’t load')}</h2>
      {state === 'failed' && <button type="button" className="session-status__retry" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</button>}
    </section>
  </div>;

  const own = player.community?.id === details.id;
  return <div className="community-page">
    <header className="community-header">
      <Sigil sigil={details.sigil} size={132} className="community-header-sigil" />
      <div className="community-header-info">
        <p className="community-tag">{details.tag}</p>
        <h1>{details.name}</h1>
        <p className="community-meta">
          {t('communityMembers', {count: details.members})}
          {own && <span className="community-own">{t('Your community')}</span>}
        </p>
      </div>
      <dl className="community-week">
        <div><dt>{t('Weekly rank')}</dt><dd>{details.season.rank ? `#${details.season.rank}` : '–'}</dd></div>
        <div><dt>{t('Ranked wins')}</dt><dd>{formatNumber(details.season.wins)}</dd></div>
        <div><dt>{t('Ranked games')}</dt><dd>{formatNumber(details.season.games)}</dd></div>
        <p className="community-week-end">{t('Week ends {{value0}}', {value0: weekEndLabel(details.seasonEnd)})}</p>
      </dl>
    </header>

    <section className="community-members">
      <div className="community-section-head">
        <h2>{t('Top members')}</h2>
        <Link href="/rank?tab=communities" className="community-link">{t('Community ranking')}</Link>
      </div>
      {details.topMembers.length ? <ol className="community-member-list">
        {details.topMembers.map((member, index) => <li key={member.id} className={member.id === player.uid ? 'is-self' : ''}>
          <span className="community-member-rank">{index + 1}</span>
          <Link href={`/profile/${member.id}`} className="community-member">
            <img className="community-member-avatar" src={loadAvatar(member.avatar)} alt="" />
            <span className="community-member-name">{member.name}</span>
          </Link>
          <img className="community-member-league" src={getLeagueIcon(member.league)} alt="" />
          <span className="community-member-stat"><span>{t('ELO')}</span> {formatNumber(member.elo)}</span>
          <span className="community-member-stat"><span>{t('Wins this week')}</span> {formatNumber(member.weeklyWins)}</span>
        </li>)}
      </ol> : <p className="table-empty-inline">{t('No members yet')}</p>}
    </section>
  </div>;
}
