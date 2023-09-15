// PlayPage.tsx
import { h, Component } from 'preact';

class RankPage extends Component {
  state = {
    leaderboardData: [
      { rank: 1, player: 'Player1', elo: 1500, wins: 10, losses: 2, crowdScore: '200K' },
      { rank: 2, player: 'Player2', elo: 1400, wins: 8, losses: 3, crowdScore: '150K' },
      // Add more dummy data here
    ],
    columns: ['rank', 'player', 'elo', 'wins', 'losses', 'wins ratio', 'crowd score'],
    sortColumn: 'elo',
    sortAscending: false
  };

  handleSort = (column) => {
    const isAscending = this.state.sortColumn === column ? !this.state.sortAscending : false;
    const sortedData = [...this.state.leaderboardData].sort((a, b) => {
      if (a[column] < b[column]) return isAscending ? -1 : 1;
      if (a[column] > b[column]) return isAscending ? 1 : -1;
      return 0;
    });

    this.setState({
      leaderboardData: sortedData,
      sortColumn: column,
      sortAscending: isAscending
    });
  };

  render() {
    return (
      <div>
        <div className="page-header">
          <img src="assets/rank.png" className="page-icon" />
          <h1 className="page-title">Rank</h1>
        </div>
        <div className="rank-content">
        <table className="leaderboard-table">
            <thead>
              <tr>
              {this.state.columns.map(column => (
                <th onClick={() => this.handleSort(column)}>
                  <div>
                    <span>{column.charAt(0).toUpperCase() + column.slice(1)}</span>
                    <span>
                      {this.state.sortColumn === column ? (this.state.sortAscending ? <i class="fa-solid fa-sort-up"></i> : <i class="fa-solid fa-sort-down"></i>) : <i class="fa-solid fa-sort" style={{visibility: 'hidden'}}></i>}
                    </span>
                  </div>
                </th>
              ))}
              </tr>
            </thead>
            <tbody>
              {this.state.leaderboardData.map((data, index) => (
                <tr key={index}>
                  <td>#{data.rank}</td>
                  <td>{data.player}</td>
                  <td>{data.elo}</td>
                  <td>{data.wins}</td>
                  <td>{data.losses}</td>
                  <td>{Math.round((data.wins/(data.wins+data.losses))*100)}%</td>
                  <td>{data.crowdScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default RankPage;