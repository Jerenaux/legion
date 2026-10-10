import {h} from 'preact';
import PageIntro, {shouldShowPageIntro} from '../pageIntro/PageIntro';
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

/** First Rank visit only (per account on this device); the Rank page can reopen it. */
export const shouldShowRankIntro = (uid: string) => shouldShowPageIntro('rank', uid);

const percent = (ratio: number) => formatNumber(ratio, {style: 'percent', maximumFractionDigits: 0});

export default function RankIntro({uid, onClose}: {uid: string; onClose: () => void}) {
  const steps = [
    {
      title: t('Leagues and weekly seasons'),
      art: <div className="page-intro-leagues">
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
      art: <div className="page-intro-zones">
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
      art: <div className="page-intro-elo">
        <span className="page-intro-wins"><strong>0</strong><small>{t('Wins')}</small></span>
        <img src={alltimeRank} alt="" />
        <span className="page-intro-rating"><strong>ELO</strong><small>{t('All seasons')}</small></span>
      </div>,
      lines: [
        t('Wins and losses start from zero every season.'),
        t('Your ELO rating carries over from season to season. It rises or falls after every ranked match and orders the All-time tab.'),
      ],
    },
  ];
  return <PageIntro page="rank" uid={uid} label={t('How leagues work')} steps={steps} finishLabel={t('See my league')} onClose={onClose} />;
}
