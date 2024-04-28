// AwardedPlayer.tsx
import './AwardedPlayer.style.css';
import { h, Component } from 'preact';

interface AwardedPlayerProps {
    players: {
        player: string;
        avatar: string,
        title: string,
        description: string;
    }[]
}

class AwardedPlayer extends Component<AwardedPlayerProps> {

  render() {
    return (
      <div className="highlights-container">
        {this.props.players.map(player => <div className="award-player-container">
            <img src="/rank/player_profile_bg.png" alt="profile" />
            <span className="award-player-name">{player.player}</span>
            <span className="award-player-title">{player.title}</span>

            <span className="award-player-desc">{player.description}</span>
        </div>)}
      </div>
    );
  }
}

export default AwardedPlayer;