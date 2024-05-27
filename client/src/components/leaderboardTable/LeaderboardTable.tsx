// LeaderboardTable.tsx
import './LeaderboardTable.style.css';
import { h, Component } from 'preact';

interface LeaderboardTableProps {
    data: {
        "rank": number,
        "player": string,
        "elo": number,
        "wins": number,
        "losses": number,
        "winsRatio": string,
        "isFriend"?: boolean,
    }[];
    promotionRows: number;
    demotionRows: number;
    camelCaseToNormal: (text: string) => string;
    rankRowNumberStyle: (index: number) => {};
}

enum rewardImage {
    'gold_chest',
    'silver_chest',
    'bronze_chest'
}


enum columnType {
    "elo" = "elo",
    "losses" = "losses",
    "player name" = "player",
    "no" = "rank",
    "wins" = "wins",
    "wins ratio" = "winsRatio",
    "rewards" = "rewards"
}

class LeaderboardTable extends Component<LeaderboardTableProps> {
    state = {
        tableData: [],
        isAscending: Array(4).fill(false)
    }

    async componentDidMount() {
        this.setState({ tableData: this.props.data });
    }

    async componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data) {
            this.setState({ tableData: this.props.data });
        }
    }

    handleSort(column: string, index: number) {
        if (index < 2 || index > 5) return;

        const sortedData = this.state.tableData.sort((a, b) => {
            if (isNaN(a[column])) {
                const aTemp = parseFloat(a[column].match(/\d+(\.\d+)?/)[0]);
                const bTemp = parseFloat(b[column].match(/\d+(\.\d+)?/)[0]);

                return this.state.isAscending[index - 2] ? aTemp - bTemp : bTemp - aTemp;
            } else {
                return this.state.isAscending[index - 2] ? a[column] - b[column] : b[column] - a[column];
            }
        })

        let ascendingTemp = this.state.isAscending;
        ascendingTemp[index - 2] = !this.state.isAscending[index - 2];

        this.setState({
            tableData: sortedData,
            isAscending: [...ascendingTemp]
        });
    }

    render() {
        const { demotionRows, promotionRows, rankRowNumberStyle, camelCaseToNormal } = this.props;
        const columns = ['no', 'player name', 'elo', 'wins', 'losses', 'wins ratio', 'rewards'];

        const getUpgradeImage = (index: number) => {
            if (index <= promotionRows) return {
                backgroundImage: `url(/leaderboard/promote_icon.png)`,
            }

            if (index > this.state.tableData.length - demotionRows) return {
                backgroundImage: `url(/leaderboard/demote_icon.png)`,
            }

            return {
                backgroundImage: '',
            }
        }

        const getRowBG = (index: number) => {
            if (this.state.tableData[index].player.includes('Me')) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_own.png)`,
            }

            if (this.state.tableData[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_friend.png)`,
            }

            return;
        }

        const rankRowAvatar = (index: number) => {
            if (this.state.tableData[index].player.includes('Me')) return {
                backgroundImage: `url(/leaderboard/leaderboard_avatar_frame.png)`,
            }

            if (this.state.tableData[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_avatar_frame_friend.png)`,
            }

            return;
        }

        const sortIconStyle = (index: number) => {
            return {
                transform: `rotate(${this.state.isAscending[index - 2] ? '180' : '0'}deg)`
            }
        }

        return (
            <div className="rank-table-container">
                <table className="rank-table">
                    <thead>
                        <tr>
                            {columns.map((column, i) => (
                                <th key={i} onClick={() => this.handleSort(columnType[column], i)}>
                                    <span>{camelCaseToNormal(column)}</span>
                                    {(i > 1 && i < 6) && <img className="thead-sort-icon" src="/leaderboard/arrow.png" alt="" style={sortIconStyle(i)} />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {this.state.tableData.map((item, index) => (
                            <tr key={index} className={item.player === 'Me' ? 'highlighted-row' : ''} style={getRowBG(index)}>
                                <td className="rank-row">
                                    <div className="rank-row-number" style={rankRowNumberStyle(this.state.tableData[index].rank)}>{item.rank}</div>
                                    <div className="rank-row-avatar" style={rankRowAvatar(index)}></div>
                                    <div className="rank-row-upgrade" style={getUpgradeImage(this.state.tableData[index].rank)}></div>
                                </td>
                                <td>{item.player}</td>
                                <td>{item.elo}</td>
                                <td className="rank-row-win">{item.wins}</td>
                                <td>{item.losses}</td>
                                <td className="rank-row-winRatio">{item.winsRatio}</td>
                                <td className="rank-row-reward">{this.state.tableData[index].rank <= 3 && <img src={`/shop/${rewardImage[this.state.tableData[index].rank - 1]}.png`} alt="" />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

export default LeaderboardTable;