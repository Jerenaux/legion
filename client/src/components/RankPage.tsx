// PlayPage.tsx
import { h, Component } from 'preact';
import axios from 'axios';

class RankPage extends Component {
  state = {
   leaderboardData: [],
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

  camelCaseToNormal = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  async componentDidMount() {
    const response = await axios.get(`${process.env.PREACT_APP_API_URL}/fetchLeaderboard`);
    if (response.data) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({ leaderboardData: response.data });
    }
  }

  render() {
    const columns = ['rank', 'player', 'elo', 'wins', 'losses', 'winsRatio', 'crowdScore']; 

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
                {columns.map(column => (
                  <th key={column} onClick={() => this.handleSort(column)}>
                    <div>
                      <span>{this.camelCaseToNormal(column)}</span>
                      <span>
                        {this.state.sortColumn === column ? (this.state.sortAscending ? <i class="fa-solid fa-sort-up" /> : <i class="fa-solid fa-sort-down" />) : <i class="fa-solid fa-sort" style={{visibility: 'hidden'}} />}
                      </span>
                    </div>
                  </th>
                ))}
                </tr>
              </thead>
              <tbody>
                {this.state.leaderboardData.map((data, index) => (
                  <tr key={index} className={data.player === 'Me' ? 'highlighted-row' : ''}>
                    <td>#{data.rank}</td>
                    <td>{data.player}</td>
                    <td>{data.elo}</td>
                    <td>{data.wins}</td>
                    <td>{data.losses}</td>
                    <td>{data.winsRatio}</td>
                    <td>{Array.from({length: data.crowdScore}, (_, i) => <i key={i} class="fa-solid fa-star golden-star" />)}</td>
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