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
    columns: any;
    promotionRows: number;
    demotionRows: number;
    handleSort: (column: any) => void;
    camelCaseToNormal: (text: string) => string;
}

enum rankNoImage {
    'gold_rankno',
    'silver_rankno',
    'bronze_rankno'
}

enum rewardImage {
    'gold_chest',
    'silver_chest',
    'bronze_chest'
}

class LeaderboardTable extends Component<LeaderboardTableProps> {

    render() {
        const { data, demotionRows, promotionRows, columns, handleSort, camelCaseToNormal } = this.props;

        const rankRowNumberStyle = (index: number) => {
            return index < 3 ? {
                backgroundImage: `url(/leaderboard/${rankNoImage[index]}.png)`,
            } : {
                backgroundImage: `url(/leaderboard/idle_rankno.png)`,
            }
        }

        const getUpgradeImage = (index: number) => {
            if (index < promotionRows) return {
                backgroundImage: `url(/leaderboard/promote_icon.png)`,
            }

            if (index >= data.length - demotionRows) return {
                backgroundImage: `url(/leaderboard/demote_icon.png)`,
            }

            return {
                backgroundImage: '',
            }
        }

        const getRowBG = (index: number) => {
            if (data[index].player.includes('Me')) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_own.png)`,
            }

            if (data[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_bg_friend.png)`,
            }

            return;
        }

        const rankRowAvatar = (index: number) => {
            if (data[index].player.includes('Me')) return {
                backgroundImage: `url(/leaderboard/leaderboard_avatar_frame.png)`,
            }

            if (data[index].isFriend) return {
                backgroundImage: `url(/leaderboard/leaderboard_avatar_frame_friend.png)`,
            }

            return;
        }

        return (
            <div className="rank-table-container">
                <table className="rank-table">
                    <thead>
                        <tr>
                            {columns.map((column, i) => (
                                <th key={i} onClick={() => { }}>
                                    <span>{camelCaseToNormal(column)}</span>
                                    {(i > 1 && i < 6) && <img className="thead-sort-icon" src="/leaderboard/arrow.png" alt="" />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => (
                            <tr key={index} className={item.player === 'Me' ? 'highlighted-row' : ''} style={getRowBG(index)}>
                                <td className="rank-row">
                                    <div className="rank-row-number" style={rankRowNumberStyle(index)}>{item.rank}</div>
                                    <div className="rank-row-avatar" style={rankRowAvatar(index)}></div>
                                    <div className="rank-row-upgrade" style={getUpgradeImage(index)}></div>
                                </td>
                                <td>{item.player}</td>
                                <td>{item.elo}</td>
                                <td className="rank-row-win">{item.wins}</td>
                                <td>{item.losses}</td>
                                <td className="rank-row-winRatio">{item.winsRatio}</td>
                                <td className="rank-row-reward">{index < 3 && <img src={`/shop/${rewardImage[index]}.png`} alt="" />}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

export default LeaderboardTable;