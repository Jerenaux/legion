import { ChestColor, League } from "@legion/shared/enums";
import { LeaderboardRow} from "@legion/shared/interfaces";
import './LeaderboardTable.style.css';
import { h, Component } from 'preact';
import { loadAvatar } from '../utils';
import Skeleton from 'react-loading-skeleton';
import { route } from 'preact-router';

// Import image assets
import promoteIcon from '@assets/leaderboard/promote_icon.png';
import demoteIcon from '@assets/leaderboard/demote_icon.png';
import leaderboardBg from '@assets/leaderboard/leaderboard_bg.png';
import leaderboardBgOwn from '@assets/leaderboard/leaderboard_bg_own.png';
import leaderboardBgFriend from '@assets/leaderboard/leaderboard_bg_friend.png';
import leaderboardBgActive from '@assets/leaderboard/leaderboard_bg_active.png';
import arrowIcon from '@assets/leaderboard/arrow.png';
import goldChest from '@assets/shop/gold_chest.png';
import silverChest from '@assets/shop/silver_chest.png';
import bronzeChest from '@assets/shop/bronze_chest.png';

interface LeaderboardTableProps {
    data: LeaderboardRow[];
    league: number;
    camelCaseToNormal: (text: string) => string;
    rankRowNumberStyle: (index: number) => React.CSSProperties;
}

interface LeaderboardTableState {
    tableData: LeaderboardRow[];
    league: number;
    isAscending: boolean[];
    hoveredRow: number | null;
}

const rewardImage = {
    [ChestColor.BRONZE]: bronzeChest,
    [ChestColor.SILVER]: silverChest,
    [ChestColor.GOLD]: goldChest
};

enum columnType {
    "elo" = "elo",
    "losses" = "losses",
    "player name" = "player",
    "no" = "rank",
    "wins" = "wins",
    "wins ratio" = "winsRatio",
    "rewards" = "rewards"
}

class LeaderboardTable extends Component<LeaderboardTableProps, LeaderboardTableState> {
    state: LeaderboardTableState = {
        tableData: [],
        league: 0,
        isAscending: Array(6).fill(false),
        hoveredRow: null
    }

    componentDidMount() {
        this.setState(
            { tableData: this.props.data, league: this.props.league }
        );
    }

    componentDidUpdate(prevProps: LeaderboardTableProps) {
        if (prevProps.data !== this.props.data) {
            this.setState({ tableData: this.props.data, league: this.props.league });
        }
    }

    handleSort(column: string, index: number) {
        if (index != 0 && (index < 2 || index > 5)) return;

        const sortedData = [...this.state.tableData].sort((a, b) => {
            // Handle cases where the column value might be undefined or null
            const aValue = a[column];
            const bValue = b[column];
            
            // If either value is undefined/null, sort it to the end
            if (!aValue && aValue !== 0) return 1;
            if (!bValue && bValue !== 0) return -1;
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                // Handle percentage strings or other number-containing strings
                const aMatch = aValue.match(/\d+(\.\d+)?/);
                const bMatch = bValue.match(/\d+(\.\d+)?/);
                
                if (aMatch && bMatch) {
                    const aTemp = parseFloat(aMatch[0]);
                    const bTemp = parseFloat(bMatch[0]);
                    return this.state.isAscending[index] ? aTemp - bTemp : bTemp - aTemp;
                }
                // If not number strings, do regular string comparison
                return this.state.isAscending[index] 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
            }
            
            // Handle numeric values
            return this.state.isAscending[index] 
                ? Number(aValue) - Number(bValue) 
                : Number(bValue) - Number(aValue);
        });

        const ascendingTemp = [...this.state.isAscending];
        ascendingTemp[index] = !this.state.isAscending[index];

        this.setState({
            tableData: sortedData,
            isAscending: ascendingTemp
        });
    }

    handleRowHover = (index: number | null) => {
        this.setState({ hoveredRow: index });
    }

    handleRowClick = (playerId: string) => {
        route(`/profile/${playerId}`);
    };

    getRowBG = (player: LeaderboardRow, index: number): React.CSSProperties => {
        if (player.isPlayer) {
            return { backgroundImage: `url(${leaderboardBgOwn})` };
        } else if (player.isFriend) {
            return { backgroundImage: `url(${leaderboardBgFriend})` };
        } else if (this.state.hoveredRow === index) {
            return { backgroundImage: `url(${leaderboardBgActive})` };
        } else {
            return { backgroundImage: `url(${leaderboardBg})` };
        }
    };

    getUpgradeImage = (isPromoted: boolean, isDemoted: boolean): string => {
        if (this.state.league == 5) {
            return '';
        }

        if (isPromoted) {
            return `url(${promoteIcon})`;
        }
        if (isDemoted) {
            return `url(${demoteIcon})`;
        }
        return '';
    }

    render() {
        const { rankRowNumberStyle, camelCaseToNormal } = this.props;
        const columns = ['rank', 'player name', 'elo', 'wins', 'losses', 'wins ratio', 'rewards'];

        const rankRowAvatar = (index: number) => { 
            return {
                backgroundImage: `url(${loadAvatar(this.state.tableData[index].avatar)})`
            }
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
                                        {(i !== 1 && i < 6) && <img className="thead-sort-icon" src={arrowIcon} alt="" style={sortIconStyle(i)} />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {this.props.data ? this.state.tableData.map((item: LeaderboardRow, index: number) => (
                            <tr 
                                key={index} 
                                className={`${item.player === 'Me' ? 'highlighted-row' : ''} clickable-row`}
                                style={this.getRowBG(item, index)}
                                onMouseEnter={() => this.handleRowHover(index)}
                                onMouseLeave={() => this.handleRowHover(null)}
                                onClick={() => this.handleRowClick(item.playerId)}
                            >
                                <td className="rank-row">
                                    <div className="rank-row-number" style={rankRowNumberStyle(item.rank)}>{item.rank}</div>
                                    <div className="rank-row-avatar" style={rankRowAvatar(index)}></div>
                                    <div 
                                        className="rank-row-upgrade" 
                                        style={{ backgroundImage: this.getUpgradeImage(item.isPromoted, item.isDemoted) }}
                                    ></div>
                                </td>
                                <td>{item.player}</td>
                                <td>{item.elo}</td>
                                <td className="rank-row-win">{item.wins}</td>
                                <td>{item.losses}</td>
                                <td className="rank-row-winRatio">{item.winsRatio}</td>
                                <td className="rank-row-reward">
                                    {item.chestColor && rewardImage[item.chestColor] && 
                                        <img src={rewardImage[item.chestColor]} alt={`${ChestColor[item.chestColor]} chest`} />
                                    }
                                </td>
                            </tr>
                        )) : <Skeleton
                            height={46}
                            count={6}
                            highlightColor='#0000004d'
                            baseColor='#0f1421'
                            style={{ margin: '4px 0 0px', width: '940px' }}
                        />}
                    </tbody>
                </table>
                <div style={this.state.tableData.length === 0 ? { display: "block" } : { display: "none" }} className="table-empty">
                    No players in this league yet
                </div>
            </div>
        );
    }
}

export default LeaderboardTable;