// RankPage.tsx
import { h, Component } from 'preact';
import { apiFetch } from '../services/apiService';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';
import AwardedPlayer from './awardedPlayer/AwardedPlayer';
import { rankNoImage } from '@legion/shared/enums';
import { PlayerContext } from '../contexts/PlayerContext';
import { startTour } from './tours';
import 'react-loading-skeleton/dist/skeleton.css'

import Skeleton from 'react-loading-skeleton';

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
      elo: this.context.player.elo,
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
    startTour('rank', this.context.player.tours);
  }

  handleCurrTab = (index: number) => {
    this.setState({ curr_tab: index }, async () => {
      await this.fetchLeaderboard();
    });
  }
  
  render() {
    if (!this.state.leaderboardData) return;

    const tabs = ['bronze', 'silver', 'gold', 'zenith', 'apex', 'alltime'];

    const getRankTabStyle = (index: number) => {
      return {
        backgroundImage: `url(/shop/tabs_${index === this.state.curr_tab ? 'active' : 'idle'}.png)`,
        backgroundSize: '100% 100%',
        width: '48px',
        height: '48px',
        padding: '6px',
        cursor: 'pointer'
      }
    }

    const rankRowNumberStyle = (index: number) => {
      return index <= 3 ? {
        backgroundImage: `url(/leaderboard/${rankNoImage[index - 1]}.png)`,
      } : {
        backgroundImage: `url(/leaderboard/active_rankno.png)`,
      }
    }

    // console.log("currentLeague => ", this.context.player.league); 

    return (
      <div className="rank-content">
        <div className="flexContainer" style={{ alignItems: 'flex-end' }}>
          {this.state.leaderboardData ? <SeasonCard
            currTab={tabs[this.state.curr_tab]}
            rankRowNumberStyle={rankRowNumberStyle}
            playerRanking={this.getPlayerRankData()}
            seasonEnd={this.state.leaderboardData?.seasonEnd} /> :
            <Skeleton
              height={152}
              count={1}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '472px' }} />}

          {this.state.leaderboardData ? <AwardedPlayer players={this.state.leaderboardData.highlights} /> :
            <Skeleton
              height={74}
              count={2}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '500px' }} />
          }
        </div>

        <div className="flexContainer" style={{ gap: '24px' }}>
          <div className="rank-tab-container">
            {this.state.leaderboardData && tabs.map((tab, i) => <div key={i} style={getRankTabStyle(i)} onClick={() => this.handleCurrTab(i)}>
              <img src={`/icons/${tab}_rank.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>)}
          </div>
          {this.state.leaderboardData ? <LeaderboardTable
            data={this.state.leaderboardData.ranking}
            promotionRows={this.state.leaderboardData.promotionRows}
            demotionRows={this.state.leaderboardData.demotionRows}
            camelCaseToNormal={this.camelCaseToNormal}
            rankRowNumberStyle={rankRowNumberStyle}
          /> :
            <Skeleton
              height={46}
              count={12}
              highlightColor='#0000004d'
              baseColor='#0f1421'
              style={{ margin: '2px 0', width: '940px' }} />
          }
        </div>
      </div>
    );
  }
}

export default RankPage;