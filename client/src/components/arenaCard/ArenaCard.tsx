// ArenaCard.tsx
import './ArenaCard.style.css'
import { h, Component } from 'preact';

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
  private timer: NodeJS.Timeout | null = null;

  state = {
    active: false,
    time: this.props.gameData.duration
  }

  componentDidMount(): void {
    this.timer = setInterval(() => {
      this.setState({time: this.state.time + 1});
    }, 1000);
  }
  
  componentWillUnmount(): void {
    if(this.timer) {
      clearInterval(this.timer);
    }
  }

  render() {
    const data = this.props.gameData;
    const bgStyle = {
        backgroundImage: `url(/vs_bg_${this.state.active ? 'active' : 'idle'}.png)`,
        cursor: 'pointer'
    }

    const countDown = {
        hour: Math.floor(Math.min(23, this.state.time / 3600)),
        minute: Math.floor((this.state.time % 3600) / 60),
        second: Math.floor(this.state.time % 60)
    };

    return (
      <div className="arenaCard" style={bgStyle} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})}>
        <div className="team_a_members">
          <span><span>{data.teamA.aliveCharacters}</span>/{data.teamA.teamSize}</span>
        </div>
        <div className="team_a_info">
          <span>{data.teamA.name}</span>
          <span className="teamScore">
            {`${countDown.hour}`.padStart(2, "0")}:
            {`${countDown.minute}`.padStart(2, "0")}:
            {`${countDown.second}`.padStart(2, "0")}
          </span>
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
