import {h} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import {Link} from 'preact-router/match';
import type {CommunityRankingEntry} from '@legion/shared/communities';
import {PlayerContext} from '../../contexts/PlayerContext';
import {apiFetch} from '../../services/apiService';
import {t, formatNumber} from '../../i18n/core';
import Ghost from '../ghost/Ghost';
import Sigil from '../sigil/Sigil';
import {weekEndLabel} from './CommunityPage';
import './community.style.css';

interface RankingResponse {
  seasonEnd: number;
  ranking: CommunityRankingEntry[];
  own: CommunityRankingEntry | null;
}

function Row({entry, own}: {entry: CommunityRankingEntry; own: boolean}) {
  return <li className={own ? 'is-self' : ''}>
    <span className="community-member-rank">{entry.rank}</span>
    <Link href={`/community/${entry.id}`} className="community-member">
      <Sigil sigil={entry.sigil} size={36} />
      <span className="community-member-name">{entry.name} <span className="community-tag-chip">{entry.tag}</span></span>
    </Link>
    <span className="community-member-stat"><span>{t('Members')}</span> {formatNumber(entry.members)}</span>
    <span className="community-member-stat"><span>{t('Ranked games')}</span> {formatNumber(entry.games)}</span>
    <span className="community-member-stat community-wins"><span>{t('Ranked wins')}</span> {formatNumber(entry.wins)}</span>
  </li>;
}

/** Weekly standings of creator communities by their members' ranked wins. */
export default function CommunityRanking() {
  const {player} = useContext(PlayerContext);
  const [data, setData] = useState<RankingResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    apiFetch('getCommunityRanking', {}, 2)
      .then(result => { if (live) setData(result); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [attempt, player.community?.id]);

  if (failed) return <section className="rank-load-error" role="alert">
    <h2>{t('Rank couldn’t load')}</h2>
    <p>{t('Check your connection and try again.')}</p>
    <button type="button" className="session-status__retry" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</button>
  </section>;
  if (!data) return <Ghost height={54} count={8} className="rank-ghost-rows community-ranking" />;

  const ownListed = data.own && data.ranking.some(entry => entry.id === data.own!.id);
  return <section className="community-ranking" aria-labelledby="community-ranking-title">
    <div className="community-section-head">
      <h2 id="community-ranking-title">{t('Community ranking')}</h2>
      <span className="community-week-end">{t('Week ends {{value0}}', {value0: weekEndLabel(data.seasonEnd)})}</span>
    </div>
    {data.ranking.length ? <ol className="community-member-list">
      {data.ranking.map(entry => <Row key={entry.id} entry={entry} own={entry.id === player.community?.id} />)}
    </ol> : <p className="table-empty-inline">{t('No community has a ranked win this week.')}</p>}
    {data.own && !ownListed && <ol className="community-member-list community-own-row">
      <Row entry={data.own} own />
    </ol>}
    {!player.community && <p className="community-hint">{t('Enter a creator code on your profile to represent a community.')}</p>}
  </section>;
}
