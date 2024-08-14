// RankPage.tsx
import { h, Component } from 'preact';
import { apiFetch } from '../services/apiService';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';
import AwardedPlayer from './awardedPlayer/AwardedPlayer';
import { PlayerContext } from '../contexts/PlayerContext';
import { manageHelp } from './utils';
import 'react-loading-skeleton/dist/skeleton.css'
import Skeleton from 'react-loading-skeleton';

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

const rankIcons = {
  bronze: bronzeRankIcon,
  silver: silverRankIcon,
  gold: goldRankIcon,
  zenith: zenithRankIcon,
  apex: apexRankIcon,
  alltime: alltimeRankIcon,
};

class RankPage extends Component {
  static contextType = PlayerContext; 

  state = {
    leaderboardData: null,
    sortColumn: 'elo',
    sortAscending: false,
    curr_tab: this.context.player.league,
    tour: null
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
      metric: isAllTime ? this.context.player.elo : this.context.player.wins,
    }
  };

  async fetchLeaderboard() {
    const data = await apiFetch(`fetchLeaderboard?tab=${this.state.curr_tab}`);
    if (data) {
      console.log(`Ldb data: ${JSON.stringify(data)}`);
      this.setState({ leaderboardData: data });
    }
  }

  async componentDidMount() {
    await this.fetchLeaderboard();
    manageHelp('rank', this.context);
  }

  handleCurrTab = (index: number) => {
    this.setState({ curr_tab: index }, async () => {
      await this.fetchLeaderboard();
    });
  }
  
  render() {
    if (!this.state.leaderboardData) return null;

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

    // console.log("currentLeague => ", this.context.player.league); 

    return (
      <div className="rank-content">
        <div className="flexContainer" style={{ alignItems: 'flex-end' }}>
          {this.state.leaderboardData ? (
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

          {this.state.leaderboardData ? (
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
            {this.state.leaderboardData && tabs.map((tab, i) => (
              <div key={i} style={getRankTabStyle(i)} onClick={() => this.handleCurrTab(i)}>
                <img src={rankIcons[tab]} alt={`${tab} rank`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ))}
          </div>
          {this.state.leaderboardData ? (
            <LeaderboardTable
              data={this.state.leaderboardData.ranking}
              promotionRows={this.state.leaderboardData.promotionRank}
              demotionRows={this.state.leaderboardData.demotionRank}
              camelCaseToNormal={this.camelCaseToNormal}
              rankRowNumberStyle={rankRowNumberStyle}
            />
          ) : (
            <Skeleton
              height={46}
              count={12}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '940px' }}
            />
          )}
        </div>
      </div>
    );
  }
}

export default RankPage;