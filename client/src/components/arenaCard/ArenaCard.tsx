// ArenaCard.tsx
import './ArenaCard.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface CardProps {
    active: boolean
  }

class ArenaCard extends Component<CardProps> {

  render() {
    const bgStyle = {
        backgroundImage: `url(/vs_bg_${this.props.active ? 'active' : 'idle'}.png)`
    }

    return (
      <div className="arenaCard" style={bgStyle}>
        <div className="team_a_members">
          <span><span>3</span>/6</span>
        </div>
        <div className="team_a_info">
          <span>TEAM A</span>
          <span className="teamScore">15.03</span>
        </div>
        <div className="vsSpan"><span>VS</span></div>
        <div className="team_b_info">
          <span>TEAM B</span>
          <span className="spactators"><span>5</span> SPECTATORS</span>
        </div>
        <div className="team_b_members">
          <span><span>5</span>/6</span>
        </div>
        <div className="spectate"><span>SPECTATE</span></div>
        {this.props.active}
      </div>
    );
  }
}

export default ArenaCard;