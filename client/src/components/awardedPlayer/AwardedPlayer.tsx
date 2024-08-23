// AwardedPlayer.tsx
import './AwardedPlayer.style.css';
import { h, Component } from 'preact';

interface AwardedPlayerProps {
    players: {
        name: string;
        avatar: string,
        title: string,
        description: string;
    }[]
}

class AwardedPlayer extends Component<AwardedPlayerProps> { 

  render() {
    // console.log("awardedProps => ", this.props.players); 
    return (
      <div className="highlights-container">
        {this.props.players.map(player => <div className="award-player-container">
            {/* <img src="/rank/player_profile_bg.png" alt="profile" /> */}
            <div className="award-player-avatar-container">
              <img src={`/avatars/${player.avatar}.png`} />
            </div>  
            <span className="award-player-name">{player.name}</span>
            <span className="award-player-title">{player.title}</span>

            <span className="award-player-desc">{player.description}</span>
        </div>)}
      </div>
    );
  }
}

export default AwardedPlayer;