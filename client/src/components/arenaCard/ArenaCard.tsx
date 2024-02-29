// ArenaCard.tsx
import './ArenaCard.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';

type Team = {
  name: string;
  teamSize: number;
  aliveCharacters: number;
}

type Game = {
  teamA: Team,
  teamB: Team,
  spectators: number,
  duration: number,
}

interface CardProps {
    gameData: Game
}

class ArenaCard extends Component<CardProps> {

  state = {
    active: false
  }

  render() {
    const data = this.props.gameData;
    const bgStyle = {
        backgroundImage: `url(/vs_bg_${this.state.active ? 'active' : 'idle'}.png)`,
        cursor: 'pointer'
    }

    return (
      <div className="arenaCard" style={bgStyle} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})}>
        <div className="team_a_members">
          <span><span>{data.teamA.aliveCharacters}</span>/{data.teamA.teamSize}</span>
        </div>
        <div className="team_a_info">
          <span>{data.teamA.name}</span>
          <span className="teamScore">{data.duration}</span>
        </div>
        <div className="vsSpan"><span>VS</span></div>
        <div className="team_b_info">
          <span>{data.teamB.name}</span>
          <span className="spactators"><span>{data.spectators}</span> SPECTATORS</span>
        </div>
        <div className="team_b_members">
          <span><span>{data.teamB.aliveCharacters}</span>/{data.teamB.teamSize}</span>
        </div>
        <div className="spectate"><span>SPECTATE</span></div>
      </div>
    );
  }
}

export default ArenaCard;