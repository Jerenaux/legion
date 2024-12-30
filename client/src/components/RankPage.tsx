import { h, Component } from 'preact';
import { apiFetch } from '../services/apiService';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';
import AwardedPlayer from './awardedPlayer/AwardedPlayer';
import { PlayerContext } from '../contexts/PlayerContext';
import 'react-loading-skeleton/dist/skeleton.css'
import Skeleton from 'react-loading-skeleton';
import { APILeaderboardResponse } from "@legion/shared/interfaces";


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
}

class RankPage extends Component<{}, State> {
  static contextType = PlayerContext;

  state: State = {
    leaderboardData: null,
    sortColumn: 'elo',
    sortAscending: false,
    curr_tab: this.context.player.league,
    tour: null,
    isLoading: true,
  };

  camelCaseToNormal = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  getPlayerRankData = () => {
    const isCorrectLeague = this.context.player.league === this.state.curr_tab;
    const isAllTime = this.state.curr_tab === 5;
    return {
      rank: isAllTime ? this.context.player.allTimeRank : (isCorrectLeague ? this.context.player.rank : "-"),
      metric: isAllTime ? this.context.player.elo : (isCorrectLeague ? this.context.player.wins : "-"),
    }
  };

  async fetchLeaderboard() {
    this.setState({ isLoading: true });

    const data = await apiFetch(`fetchLeaderboard?tab=${this.state.curr_tab}`);
    if (data) {
      this.setState({ leaderboardData: data, isLoading: false });
    }
  }

  async componentDidMount() {
    await this.fetchLeaderboard();
    this.context.manageHelp('rank');
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
      <div className="rank-content">
        <div className="flexContainer" style={{ alignItems: 'flex-end' }}>
          {!this.state.isLoading ? (
            <SeasonCard
              currTab={tabs[this.state.curr_tab]}
              rankRowNumberStyle={rankRowNumberStyle}
              playerRanking={this.getPlayerRankData()}
              seasonEnd={this.state.leaderboardData?.seasonEnd}
            />
          ) : (
            <Skeleton
              height={152}
              count={1}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '472px' }}
            />
          )}

          {!this.state.isLoading ? (
            <AwardedPlayer players={this.state.leaderboardData.highlights} />
          ) : (
            <Skeleton
              height={74}
              count={2}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '500px' }}
            />
          )}
        </div>

        <div className="flexContainer" style={{ gap: '24px' }}>
          <div className="rank-tab-container">
            {rankIcons.map((icon, i) => (
              <div key={i} style={getRankTabStyle(i)} onClick={() => this.handleCurrTab(i)}>
                <img src={icon} alt={tabs[i]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ))}
          </div> 

          {!this.state.isLoading ?
            <LeaderboardTable
              data={this.state.leaderboardData.ranking}
              league={this.state.leaderboardData.league}
              camelCaseToNormal={this.camelCaseToNormal}
              rankRowNumberStyle={rankRowNumberStyle}
            /> :
            <Skeleton
              height={46}
              count={12}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '940px' }}
            />
          }
        </div>
      </div>
    );
  }
}

export default RankPage;