import {t} from '../i18n/core';

import { h } from 'preact';
import { Component } from 'preact';
import { apiFetch } from '../services/apiService';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';
import AwardedPlayer from './awardedPlayer/AwardedPlayer';
import { PlayerContext } from '../contexts/PlayerContext';
import Ghost from './ghost/Ghost';
import { APILeaderboardResponse } from "@legion/shared/interfaces";
import CommunityRanking from './community/CommunityRanking';
import Sigil from './sigil/Sigil';



// Import image assets
import tabsActiveImage from '@assets/shop/tabs_active.png';
import tabsIdleImage from '@assets/shop/tabs_idle.png';
import activeRankNoImage from '@assets/leaderboard/active_rankno.png';
import bronzeRankIcon from '@assets/icons/bronze_rank.png';
import silverRankIcon from '@assets/icons/silver_rank.png';
import goldRankIcon from '@assets/icons/gold_rank.png';
import zenithRankIcon from '@assets/icons/zenith_rank.png';
import apexRankIcon from '@assets/icons/apex_rank.png';
import alltimeRankIcon from '@assets/icons/alltime_rank.png';

import goldRankNo from '@assets/leaderboard/gold_rankno.png';
import silverRankNo from '@assets/leaderboard/silver_rankno.png';
import bronzeRankNo from '@assets/leaderboard/bronze_rankno.png';

const rankNoImage = [
  goldRankNo,
  silverRankNo,
  bronzeRankNo,
];

export const rankIcons = [
  bronzeRankIcon,
  silverRankIcon,
  goldRankIcon,
  zenithRankIcon,
  apexRankIcon,
  alltimeRankIcon,
];

interface State {
  curr_tab: number;
  leaderboardData: APILeaderboardResponse | null;
  sortColumn: string;
  sortAscending: boolean;
  tour: string | null;
  isLoading: boolean;
  loadFailed: boolean;
}

class RankPage extends Component<{}, State> {
  static contextType = PlayerContext;
  static COMMUNITY_TAB = 6;
  static COMMUNITY_TAB_SIGIL = {shape: 0, pattern: 7, palette: 0, symbol: 2};
  private leaderboardRequest = 0;

  state: State = {
    leaderboardData: null,
    sortColumn: 'elo',
    sortAscending: false,
    curr_tab: /[?&]tab=communities\b/.test(globalThis.location?.search ?? '') ? RankPage.COMMUNITY_TAB : this.context.player.league,
    tour: null,
    isLoading: true,
    loadFailed: false,
  };

  camelCaseToNormal = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  getPlayerRankData = () => {
    const isCorrectLeague = this.context.player.league === this.state.curr_tab;
    const isAllTime = this.state.curr_tab === 5;
    return {
      rank: this.state.leaderboardData?.playerRank ?? "-",
      metric: isAllTime ? this.context.player.elo : (isCorrectLeague ? this.context.player.wins : "-"),
    }
  };

  async fetchLeaderboard() {
    const request = ++this.leaderboardRequest;
    if (this.state.curr_tab === RankPage.COMMUNITY_TAB) {
      this.setState({ isLoading: false, loadFailed: false });
      return;
    }
    this.setState({ isLoading: true, loadFailed: false });

    try {
      // This is a read-only request: retry once after a transient timeout or failure.
      const data = await apiFetch(`fetchLeaderboard?tab=${this.state.curr_tab}`, {}, 2);
      if (request !== this.leaderboardRequest) return;
      if (!data) throw new Error('Leaderboard response was empty');
      this.setState({ leaderboardData: data, isLoading: false });
    } catch {
      if (request !== this.leaderboardRequest) return;
      this.setState({ isLoading: false, loadFailed: true });
    }
  }

  componentWillUnmount() {
    this.leaderboardRequest++;
  }

  async componentDidMount() {
    await this.fetchLeaderboard();
  }

  handleCurrTab = (index: number) => {
    this.setState({ curr_tab: index }, async () => {
      await this.fetchLeaderboard();
    });
  }

  render() {
    const tabs = ['bronze', 'silver', 'gold', 'zenith', 'apex', 'alltime'];

    const getRankTabStyle = (index: number) => {
      return {
        backgroundImage: `url(${index === this.state.curr_tab ? tabsActiveImage : tabsIdleImage})`,
        backgroundSize: '100% 100%',
        width: '48px',
        height: '48px',
        padding: '6px',
        cursor: 'pointer'
      }
    }

    const rankRowNumberStyle = (index: number) => {
      return index <= 3 ? {
        backgroundImage: `url(${rankNoImage[index - 1]})`,
      } : {
        backgroundImage: `url(${activeRankNoImage})`,
      }
    }

    return (
      <div className="rank-content" aria-busy={this.state.isLoading}>
        {!this.state.loadFailed && this.state.curr_tab !== RankPage.COMMUNITY_TAB && <div className="flexContainer" style={{ alignItems: 'flex-end' }}>
          {!this.state.isLoading ? (
            <SeasonCard
              currTab={tabs[this.state.curr_tab]}
              rankRowNumberStyle={rankRowNumberStyle}
              playerRanking={this.getPlayerRankData()}
              seasonEnd={this.state.leaderboardData?.seasonEnd}
            />
          ) : (
            <Ghost height={180} width="310px" className="ghost-inline" />
          )}

          {!this.state.isLoading ? (
            <AwardedPlayer players={this.state.leaderboardData.highlights} />
          ) : (
            <Ghost height={150} width="150px" className="ghost-inline" />
          )}
        </div>}

        <div className="flexContainer" style={{ gap: '24px' }}>
          <div className="rank-tab-container">
            {rankIcons.map((icon, i) => (
              <button type="button" data-game-control key={i} style={getRankTabStyle(i)} title={t(tabs[i])} aria-pressed={i === this.state.curr_tab} onClick={() => this.handleCurrTab(i)}>
                <img src={icon} alt={t(tabs[i])} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </button>
            ))}
            <button type="button" data-game-control style={getRankTabStyle(RankPage.COMMUNITY_TAB)} title={t('Communities')} aria-pressed={this.state.curr_tab === RankPage.COMMUNITY_TAB} onClick={() => this.handleCurrTab(RankPage.COMMUNITY_TAB)}>
              <Sigil sigil={RankPage.COMMUNITY_TAB_SIGIL} size={36} label={t('Communities')} />
            </button>
          </div>

          {this.state.curr_tab === RankPage.COMMUNITY_TAB ? <CommunityRanking /> : this.state.loadFailed ? (
            <section className="rank-load-error" role="alert">
              <h2>{t("Rank couldn’t load")}</h2>
              <p>{t("Check your connection and try again.")}</p>
              <button type="button" className="session-status__retry" onClick={() => this.fetchLeaderboard()}>{t("Retry")}</button>
            </section>
          ) : !this.state.isLoading ?
            <LeaderboardTable
              data={this.state.leaderboardData.ranking}
              league={this.state.leaderboardData.league}
              camelCaseToNormal={this.camelCaseToNormal}
              rankRowNumberStyle={rankRowNumberStyle}
            /> :
            <Ghost height={54} count={8} className="rank-ghost-rows" />
          }
        </div>
      </div>
    );
  }
}

export default RankPage;
