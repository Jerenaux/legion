// LeaderboardTable.tsx
import { ChestColor } from "@legion/shared/enums";
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


const rewardImage = {
    [ChestColor.BRONZE]: 'gold_chest',
    [ChestColor.SILVER]: 'silver_chest',
    [ChestColor.GOLD]: 'bronze_chest'
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
        isAscending: Array(6).fill(false)
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
        // console.log("tableData => ", this.state.tableData); 

        if (index != 0 && (index < 2 || index > 5)) return;

        const sortedData = this.state.tableData.sort((a, b) => {
            if (isNaN(a[column])) {
                const aTemp = parseFloat(a[column].match(/\d+(\.\d+)?/)[0]);
                const bTemp = parseFloat(b[column].match(/\d+(\.\d+)?/)[0]);

                return this.state.isAscending[index] ? aTemp - bTemp : bTemp - aTemp;
            } else {
                return this.state.isAscending[index] ? a[column] - b[column] : b[column] - a[column];
            }
        })

        let ascendingTemp = this.state.isAscending;
        ascendingTemp[index] = !this.state.isAscending[index];

        this.setState({
            tableData: sortedData,
            isAscending: [...ascendingTemp]
        });
    }

    render() {
        const { demotionRows, promotionRows, rankRowNumberStyle, camelCaseToNormal } = this.props;
        const columns = ['rank', 'player name', 'elo', 'wins', 'losses', 'wins ratio', 'rewards'];

        const getUpgradeImage = (index: number) => {
            if (index <= promotionRows) return {
                backgroundImage: `url(/leaderboard/promote_icon.png)`,
            }

            if (demotionRows && index > this.state.tableData.length - demotionRows) return {
                backgroundImage: `url(/leaderboard/demote_icon.png)`,
            }

            return {
                backgroundImage: '',
            }
        }

        const getRowBG = (index: number) => {
            if (this.state.tableData[index].isPlayer) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_own.png)`,
            }

            if (this.state.tableData[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_friend.png)`,
            }

            return;
        }

        const rankRowAvatar = (index: number) => { 
            // console.log("tableIndexData => ", this.state.tableData[index]); 
            if (this.state.tableData[index].isPlayer) return {
                // backgroundImage: `url(/leaderboard/leaderboard_avatar_frame.png)`, 
                backgroundImage: `url(/avatars/${this.state.tableData[index].avatar}.png)`, 
            }

            if (this.state.tableData[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_avatar_frame_friend.png)`,
            }

            return;
        }

        const sortIconStyle = (index: number) => {
            return {
                transform: `rotate(${this.state.isAscending[index] ? '180' : '0'}deg)`
            }
        }

        return (
            <div className="rank-table-container">
                <table className="rank-table">
                    <thead>
                        <tr>
                            {columns.map((column, i) => (
                                <th key={i} onClick={() => this.handleSort(columnType[column], i)}>
                                    <div>
                                        <span>{camelCaseToNormal(column)}</span>
                                        {(i !== 1 && i < 6) && <img className="thead-sort-icon" src="/leaderboard/arrow.png" alt="" style={sortIconStyle(i)} />}
                                    </div>
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
                                <td className="rank-row-reward">{rewardImage[this.state.tableData[index].chestColor] && <img src={`/shop/${rewardImage[this.state.tableData[index].chestColor]}.png`} alt="" />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

export default LeaderboardTable;