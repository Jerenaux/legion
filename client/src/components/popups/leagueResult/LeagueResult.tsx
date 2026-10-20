// Friday's league rollover happens while players are away: tell them what it did on their next visit.
import {t} from '../../../i18n/core';
import { h, Component } from 'preact';
import { route } from 'preact-router';
import { LeaguesNames } from '@legion/shared/enums';
import { currentSeasonId } from '@legion/shared/season';
import { getLeagueIcon, playSoundEffect } from '../../utils';
import { sfxLevel } from '../../../sfxMix';
import achievementSound from '@assets/sfx/level_up.wav';
import '../unlockedFeature/UnlockedFeature.style.css';
import './LeagueResult.style.css';

export type LeagueResultKind = 'promoted' | 'demoted' | 'seasonEnded';

interface Props {
  kind: LeagueResultKind;
  league: number;
  onHide: () => void;
}

export class LeagueResult extends Component<Props> {
  componentDidMount() {
    if (this.props.kind === 'promoted') playSoundEffect(achievementSound, sfxLevel('level_up'));
  }

  focusOnMount = (button: HTMLButtonElement | null) => button?.focus({preventScroll: true});

  render() {
    const {kind, league, onHide} = this.props;
    const name = t(LeaguesNames[league]);
    const header = kind === 'promoted' ? t("Promoted to the {{league}} league!", {league: name})
      : kind === 'demoted' ? t("Moved down to the {{league}} league", {league: name})
      : t("A new season has begun");
    const text = kind === 'promoted' ? t("Last week’s ranked results moved you up a league.")
      : kind === 'demoted' ? t("Last week’s ranked results moved you down a league. Win ranked matches this week to climb back.")
      : t("Last week’s season is over. Ranked wins and losses start again from zero.");
    return (
      <div className="loot-popup-scrim">
        <div className={`unlocked-feature loot-popup league-result league-result--${kind}`} role="dialog" aria-modal="true" aria-labelledby="league-result-title">
          <div className="unlocked-feature-content">
            <img className="league-result-icon" src={getLeagueIcon(league)} alt="" />
            <h2 className="unlocked-feature-header" id="league-result-title">{header}</h2>
            <p className="unlocked-feature-description">{text}</p>
            <div className="unlocked-feature-buttons">
              <button type="button" className="unlocked-feature-button primary game-btn game-btn--gold" ref={this.focusOnMount}
                onClick={() => { route('/rank'); onHide(); }}>{t("See my league")}</button>
              <button type="button" className="unlocked-feature-button secondary game-btn game-btn--ink" data-desktop-cancel
                onClick={onHide}>{t("Dismiss")}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const snapshotKey = (uid: string) => `leagueSnapshot:${uid}`;
const rankedSeasonKey = (uid: string) => `rankedSeason:${uid}`;

/** Remember that this player took part in the current ranked season. */
export function recordRankedSeason(uid: string) {
  try { localStorage.setItem(rankedSeasonKey(uid), currentSeasonId()); } catch { /* storage unavailable */ }
}

/**
 * Compare the league and season with what this device last saw. Returns what changed since, once,
 * and stores the new state. The first visit only records it.
 */
export function leagueChangeSinceLastVisit(uid: string, league: number): LeagueResultKind | null {
  try {
    const season = currentSeasonId();
    const raw = localStorage.getItem(snapshotKey(uid));
    localStorage.setItem(snapshotKey(uid), JSON.stringify({league, season}));
    if (!raw) return null;
    const previous = JSON.parse(raw) as {league: number; season: string};
    if (league > previous.league) return 'promoted';
    if (league < previous.league) return 'demoted';
    if (previous.season !== season && localStorage.getItem(rankedSeasonKey(uid)) === previous.season) return 'seasonEnded';
  } catch { /* storage unavailable */ }
  return null;
}
