// LeaderboardTable.tsx
import './LeaderboardTable.style.css';
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface LeaderboardTableProps {
    data: any;
    columns: any;
    handleSort: (column: any) => void;
    camelCaseToNormal: (text: string) => string;
}

class LeaderboardTable extends Component<LeaderboardTableProps> {

    render() {
        const {columns, handleSort, camelCaseToNormal} = this.props;

        return (
            <div className="rank-table-container">
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            {columns.map(column => (
                                <th key={column} onClick={() => handleSort(column)}>
                                    <div>
                                        <span>{camelCaseToNormal(column)}</span>
                                        <span>
                                            {'elo' === column ? (!!columns ? <i class="fa-solid fa-sort-up" /> : <i class="fa-solid fa-sort-down" />) : <i class="fa-solid fa-sort" style={{ visibility: 'hidden' }} />}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {this.props.data.map((data, index) => (
                            <tr key={index} className={data.player === 'Me' ? 'highlighted-row' : ''}>
                                <td>#{data.rank}</td>
                                <td>{data.player}</td>
                                <td>{data.elo}</td>
                                <td>{data.wins}</td>
                                <td>{data.losses}</td>
                                <td>{data.winsRatio}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

export default LeaderboardTable;