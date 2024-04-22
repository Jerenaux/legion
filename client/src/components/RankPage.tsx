// PlayPage.tsx
import { h, Component } from 'preact';
import axios from 'axios';
import LeaderboardTable from './leaderboardTable/LeaderboardTable';
import SeasonCard from './seasonCard/SeasonCard';

class RankPage extends Component {
  state = {
    leaderboardData: null,
    sortColumn: 'elo',
    sortAscending: false
  };

  handleSort = (column) => {
    const isAscending = this.state.sortColumn === column ? !this.state.sortAscending : false;
    // const sortedData = [...this.state.leaderboardData].sort((a, b) => {
    //   if (a[column] < b[column]) return isAscending ? -1 : 1;
    //   if (a[column] > b[column]) return isAscending ? 1 : -1;
    //   return 0;
    // });

    this.setState({
      leaderboardData: null,
      sortColumn: column,
      sortAscending: isAscending
    });
  };

  camelCaseToNormal = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  async componentDidMount() {
    // const response = await axios.get(`${process.env.API_URL}/fetchLeaderboard`);
    // if (response.data) {
    //   this.setState({ leaderboardData: response.data });
    // }
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
      promotionRows: 5, // means, show green promotion arrows for the first 5 rows
      demotionRows: 4, // red demotion arros for last 4
      ranking: [ // Data for the rows in leaderboard
        {
          "rank": 1,
          "player": "legal_pink_iguan",
          "elo": 100,
          "wins": 4,
          "losses": 10,
          "winsRatio": "29%"
        },
        {
          "rank": 2,
          "player": "representative_s",
          "elo": 100,
          "wins": 5,
          "losses": 30,
          "winsRatio": "14%"
        },
        {
          "rank": 3,
          "player": "Me", // Row of the player viewing the leaderboard
          "elo": 100,
          "wins": 5,
          "losses": 30,
          "winsRatio": "14%"
        },
        {
          "rank": 4,
          "player": "representative_s",
          "elo": 100,
          "wins": 5,
          "losses": 30,
          "winsRatio": "14%"
        },
        {
          "rank": 5,
          "player": "representative_s",
          "elo": 100,
          "wins": 5,
          "losses": 30,
          "winsRatio": "14%",
          "isFriend": true // When true, use the green highlight for the row
        }],
    };
    this.setState({ leaderboardData: data });
  }

  render() {
    if (!this.state.leaderboardData) return;
    const columns = ['rank', 'player', 'elo', 'wins', 'losses', 'winsRatio'];

    return (
      <div className="rank-content">
        <div className="flexContainer">
          <SeasonCard playerRanking={this.state.leaderboardData?.playerRanking} seasonEnd={this.state.leaderboardData?.seasonEnd} />
          <div>Awarded Players</div>
        </div>

        <div className="flexContainer">
          <div>tabs</div>
          <LeaderboardTable data={this.state.leaderboardData.ranking} columns={columns} handleSort={this.handleSort} camelCaseToNormal={this.camelCaseToNormal} />
        </div>
      </div>
    );
  }
}

export default RankPage;