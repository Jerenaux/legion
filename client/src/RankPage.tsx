// PlayPage.tsx
import { h, Component } from 'preact';
import axios from 'axios';

class RankPage extends Component {
  state = {
   leaderboardData: [],
    sortColumn: 'elo',
    sortAscending: false
  };
  // http://127.0.0.1:5001/legion-32c6d/us-central1/leaderboardData

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
    let result = text.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  async componentDidMount() {
    const response = await axios.get('http://127.0.0.1:5001/legion-32c6d/us-central1/leaderboardData');
    if (response.data) this.setState({ leaderboardData: response.data });
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
                  <th onClick={() => this.handleSort(column)}>
                    <div>
                      <span>{this.camelCaseToNormal(column)}</span>
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
                  <tr key={index} className={data.player === 'Me' ? 'highlighted-row' : ''}>
                    <td>#{data.rank}</td>
                    <td>{data.player}</td>
                    <td>{data.elo}</td>
                    <td>{data.wins}</td>
                    <td>{data.losses}</td>
                    <td>{data.winsRatio}</td>
                    <td>{Array.from({length: data.crowdScore}, (_, i) => <i class="fa-solid fa-star golden-star"></i>)}</td>
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