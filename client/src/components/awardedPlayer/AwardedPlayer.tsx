
import { h } from 'preact';
// AwardedPlayer.tsx
import './AwardedPlayer.style.css';
import { Component } from 'preact';
import { route } from 'preact-router';
import { loadAvatar } from '../utils';
import { LeaderboardHighlight } from '@legion/shared/interfaces';

interface Props {
    players: LeaderboardHighlight[];
}

class AwardedPlayer extends Component<Props> {
    handleClick = (playerId: string) => {
        route(`/profile/${playerId}`);
    };

    render() {
        const { players } = this.props;

        return (
            <div className="highlights-container">
                {players.map((player) => (
                    <button type="button" data-game-control
                        key={player.id}
                        className="award-player-container clickable"
                        onClick={() => this.handleClick(player.id)}
                    >
                        <div className="award-player-avatar-container">
                            <img src={loadAvatar(player.avatar)} alt={player.name} />
                        </div>
                        <div className="award-player-name">{player.name}</div>
                        {player.title && <div className="award-player-title">{player.title}</div>}
                        {player.description && <div className="award-player-desc">{player.description}</div>}
                    </button>
                ))}
            </div>
        );
    }
}

export default AwardedPlayer;
