import {h} from 'preact';
import {useState} from 'preact/hooks';
import Modal from 'react-modal';
import {t, formatNumber} from '../../i18n/core';
import {PROMOTION_RATIO, DEMOTION_RATIO} from '@legion/shared/config';
import bronzeRank from '@assets/icons/bronze_rank.png';
import silverRank from '@assets/icons/silver_rank.png';
import goldRank from '@assets/icons/gold_rank.png';
import zenithRank from '@assets/icons/zenith_rank.png';
import apexRank from '@assets/icons/apex_rank.png';
import alltimeRank from '@assets/icons/alltime_rank.png';
import promoteIcon from '@assets/leaderboard/promote_icon.png';
import demoteIcon from '@assets/leaderboard/demote_icon.png';
import goldChest from '@assets/shop/gold_chest.png';
import silverChest from '@assets/shop/silver_chest.png';
import bronzeChest from '@assets/shop/bronze_chest.png';
import './RankIntro.css';

const storageKey = (uid: string) => `legion.rankIntro.v1.${uid}`;

/** First Rank visit only (per account on this device); the Rank page can reopen it. */
export function shouldShowRankIntro(uid: string): boolean {
  try { return !localStorage.getItem(storageKey(uid)); } catch { return false; }
}

const percent = (ratio: number) => formatNumber(ratio, {style: 'percent', maximumFractionDigits: 0});

export default function RankIntro({uid, onClose}: {uid: string; onClose: () => void}) {
  const [step, setStep] = useState(0);
  const close = () => {
    try { localStorage.setItem(storageKey(uid), String(Date.now())); } catch { /* Storage disabled: shows again next visit. */ }
    onClose();
  };
  const steps = [
    {
      title: t('Leagues and weekly seasons'),
      art: <div className="rank-intro-leagues">
        {[bronzeRank, silverRank, goldRank, zenithRank, apexRank].map((icon, index) =>
          <img key={icon} src={icon} alt="" style={{'--order': index}} />)}
      </div>,
      lines: [
        t('Play one ranked match to appear in your league’s ranking. Practice and casual matches don’t count.'),
        t('Your place depends on this season’s ranked wins; fewer losses break ties.'),
        t('Each season ends on Friday at 19:00 UTC.'),
      ],
    },
    {
      title: t('Promotion, demotion and chests'),
      art: <div className="rank-intro-zones">
        <img src={promoteIcon} alt="" /><img src={goldChest} alt="" /><img src={silverChest} alt="" /><img src={bronzeChest} alt="" /><img src={demoteIcon} alt="" />
      </div>,
      rows: [
        {icon: promoteIcon, text: t('The top {{value0}} with at least one win move up a league (always at least the top 3).', {value0: percent(PROMOTION_RATIO)})},
        {icon: demoteIcon, text: t('The bottom {{value0}} move down. Bronze can’t drop and Apex can’t rise.', {value0: percent(DEMOTION_RATIO)})},
        {icon: goldChest, text: t('The top 3 with a win earn a gold, silver or bronze chest.')},
      ],
      lines: [t('Missing a season never demotes you: only players who played that season move.')],
    },
    {
      title: t('Wins reset, ELO stays'),
      art: <div className="rank-intro-elo">
        <span className="rank-intro-wins"><strong>0</strong><small>{t('Wins')}</small></span>
        <img src={alltimeRank} alt="" />
        <span className="rank-intro-rating"><strong>ELO</strong><small>{t('All seasons')}</small></span>
      </div>,
      lines: [
        t('Wins and losses start from zero every season.'),
        t('Your ELO rating carries over from season to season. It rises or falls after every ranked match and orders the All-time tab.'),
      ],
    },
  ];
  const current = steps[step];
  const last = step === steps.length - 1;

  return <Modal isOpen onRequestClose={close} contentLabel={t('How leagues work')} className="rank-intro" overlayClassName="rank-intro-overlay">
    <p className="rank-intro-step" aria-live="polite">{t('Step {{value0}} of {{value1}}', {value0: step + 1, value1: steps.length})}</p>
    <div className="rank-intro-art" key={step} aria-hidden="true">{current.art}</div>
    <h2>{current.title}</h2>
    {current.rows && <ul className="rank-intro-rows">
      {current.rows.map(row => <li key={row.text}><img src={row.icon} alt="" />{row.text}</li>)}
    </ul>}
    {current.lines.map(line => <p className="rank-intro-text" key={line}>{line}</p>)}
    <div className="rank-intro-dots" aria-hidden="true">
      {steps.map((_, index) => <span key={index} className={index === step ? 'is-current' : ''} />)}
    </div>
    <div className="rank-intro-actions">
      {step > 0 ? <button type="button" className="rank-intro-secondary" onClick={() => setStep(step - 1)}>{t('Back')}</button>
        : <button type="button" className="rank-intro-secondary" data-desktop-cancel onClick={close}>{t('Skip')}</button>}
      <button type="button" className="rank-intro-primary" onClick={() => last ? close() : setStep(step + 1)}>
        {last ? t('See my league') : t('Next')}
      </button>
    </div>
  </Modal>;
}
