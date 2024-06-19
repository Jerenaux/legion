// RankPage.tsx
import { h, Component } from 'preact';
import axios from 'axios';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';
import AwardedPlayer from './awardedPlayer/AwardedPlayer';
import { rankNoImage } from '@legion/shared/enums';
import 'react-loading-skeleton/dist/skeleton.css'

import Skeleton from 'react-loading-skeleton';

const data = {
  seasonEnd: 604000, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 1,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "Me",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "representative_s",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 4,
      "player": "representative_s",
      "elo": 93,
      "wins": 7,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 5,
      "player": "representative_s",
      "elo": 94,
      "wins": 8,
      "losses": 15,
      "winsRatio": "17%",
      "isFriend": true // When true, use the green highlight for the row
    },
    {
      "rank": 6,
      "player": "legal_pink_iguan",
      "elo": 95,
      "wins": 9,
      "losses": 16,
      "winsRatio": "18%"
    },
    {
      "rank": 7,
      "player": "representative_s",
      "elo": 96,
      "wins": 10,
      "losses": 17,
      "winsRatio": "19%"
    },
    {
      "rank": 8,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 12,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 9,
      "player": "representative_s",
      "elo": 99,
      "wins": 11,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 10,
      "player": "representative_s",
      "elo": 83,
      "wins": 17,
      "losses": 9,
      "winsRatio": "21%",
    },
    {
      "rank": 11,
      "player": "legal_pink_iguan",
      "elo": 65,
      "wins": 9,
      "losses": 2,
      "winsRatio": "33%"
    },
    {
      "rank": 12,
      "player": "representative_s",
      "elo": 106,
      "wins": 10,
      "losses": 57,
      "winsRatio": "9%"
    },
    {
      "rank": 13,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 110,
      "wins": 18,
      "losses": 41,
      "winsRatio": "7%"
    },
    {
      "rank": 14,
      "player": "representative_s",
      "elo": 102,
      "wins": 24,
      "losses": 54,
      "winsRatio": "31%"
    },
    {
      "rank": 15,
      "player": "representative_s",
      "elo": 86,
      "wins": 28,
      "losses": 12,
      "winsRatio": "19%",
    },
  ],
};

const data1 = {
  seasonEnd: 604000, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 2,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "legal_pink_iguan",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "Me",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "legal_pink_iguan", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 4,
      "player": "representative_s",
      "elo": 93,
      "wins": 7,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 5,
      "player": "representative_s",
      "elo": 94,
      "wins": 8,
      "losses": 15,
      "winsRatio": "17%",
      "isFriend": true // When true, use the green highlight for the row
    }
  ],
};

const data2 = {
  seasonEnd: 604000, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 3,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "legal_pink_iguan",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "representative_s",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "Me", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 4,
      "player": "representative_s",
      "elo": 93,
      "wins": 7,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 5,
      "player": "representative_s",
      "elo": 94,
      "wins": 8,
      "losses": 15,
      "winsRatio": "17%",
      "isFriend": true // When true, use the green highlight for the row
    },
    {
      "rank": 6,
      "player": "legal_pink_iguan",
      "elo": 95,
      "wins": 9,
      "losses": 16,
      "winsRatio": "18%"
    },
    {
      "rank": 7,
      "player": "representative_s",
      "elo": 96,
      "wins": 10,
      "losses": 17,
      "winsRatio": "19%"
    }
  ],
};

const data3 = {
  seasonEnd: 600, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 4,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "legal_pink_iguan",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "representative_s",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 4,
      "player": "Me",
      "elo": 93,
      "wins": 7,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 5,
      "player": "representative_s",
      "elo": 94,
      "wins": 8,
      "losses": 15,
      "winsRatio": "17%",
      "isFriend": true // When true, use the green highlight for the row
    },
    {
      "rank": 6,
      "player": "legal_pink_iguan",
      "elo": 95,
      "wins": 9,
      "losses": 16,
      "winsRatio": "18%"
    },
    {
      "rank": 7,
      "player": "representative_s",
      "elo": 96,
      "wins": 10,
      "losses": 17,
      "winsRatio": "19%"
    },
    {
      "rank": 8,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 12,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 9,
      "player": "representative_s",
      "elo": 99,
      "wins": 11,
      "losses": 14,
      "winsRatio": "16%"
    }
  ],
};

const data4 = {
  seasonEnd: 3000, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 5,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "legal_pink_iguan",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "representative_s",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 4,
      "player": "representative_s",
      "elo": 93,
      "wins": 7,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 5,
      "player": "Me",
      "elo": 94,
      "wins": 8,
      "losses": 15,
      "winsRatio": "17%",
      "isFriend": true // When true, use the green highlight for the row
    },
    {
      "rank": 6,
      "player": "legal_pink_iguan",
      "elo": 95,
      "wins": 9,
      "losses": 16,
      "winsRatio": "18%"
    },
    {
      "rank": 7,
      "player": "representative_s",
      "elo": 96,
      "wins": 10,
      "losses": 17,
      "winsRatio": "19%"
    },
    {
      "rank": 8,
      "player": "representative_s", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 12,
      "losses": 13,
      "winsRatio": "15%"
    },
    {
      "rank": 9,
      "player": "representative_s",
      "elo": 99,
      "wins": 11,
      "losses": 14,
      "winsRatio": "16%"
    },
    {
      "rank": 10,
      "player": "representative_s",
      "elo": 83,
      "wins": 17,
      "losses": 9,
      "winsRatio": "21%",
    },
    {
      "rank": 11,
      "player": "legal_pink_iguan",
      "elo": 65,
      "wins": 9,
      "losses": 2,
      "winsRatio": "33%"
    }
  ],
};

const data5 = {
  seasonEnd: -1, // Number of seconds until end of season for countdown
  playerRanking: { // To display in the box at the top left
    rank: 3,
    player: "legal_pink_iguan",
    elo: 100,
  },
  highlights: [ // For the box at the top right
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most kills",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Highest audience score",
      description: "Lorem ipsum blabla"
    },
    {
      player: "legal_pink_iguan",
      avatar: "...",
      title: "Most wins",
      description: "Lorem ipsum blabla"
    }
  ],
  promotionRows: 2, // means, show green promotion arrows for the first 5 rows
  demotionRows: 1, // red demotion arros for last 4
  ranking: [ // Data for the rows in leaderboard
    {
      "rank": 1,
      "player": "legal_pink_iguan",
      "elo": 90,
      "wins": 4,
      "losses": 10,
      "winsRatio": "29%"
    },
    {
      "rank": 2,
      "player": "representative_s",
      "elo": 91,
      "wins": 5,
      "losses": 12,
      "winsRatio": "14%"
    },
    {
      "rank": 3,
      "player": "Me", // Row of the player viewing the leaderboard
      "elo": 92,
      "wins": 6,
      "losses": 13,
      "winsRatio": "15%"
    }
  ],
};

const dataTemp = [data, data1, data2, data3, data4, data5];

class RankPage extends Component {
  state = {
    leaderboardData: null,
    sortColumn: 'elo',
    sortAscending: false,
    curr_tab: 0
  };

  camelCaseToNormal = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  async componentDidMount() {
    // const response = await axios.get(`${process.env.API_URL}/fetchLeaderboard?tab=${this.state.curr_tab}`);
    // if (response.data) {
    //   this.setState({ leaderboardData: response.data });
    // }

    this.setState({ leaderboardData: dataTemp[this.state.curr_tab] });
  }

  handleCurrTab = (index: number) => {
    this.setState({ curr_tab: index });
    this.setState({ leaderboardData: dataTemp[index] });
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

    return (
      <div className="rank-content">
        <div className="flexContainer" style={{ alignItems: 'flex-end' }}>
          {this.state.leaderboardData ? <SeasonCard
            currTab={tabs[this.state.curr_tab]}
            rankRowNumberStyle={rankRowNumberStyle}
            playerRanking={this.state.leaderboardData?.playerRanking}
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