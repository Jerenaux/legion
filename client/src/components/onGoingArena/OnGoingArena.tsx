// OnGoing Arena.tsx
import './OnGoingArena.style.css';
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import ArenaCard from '../arenaCard/ArenaCard';

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

interface ArenaProps {
  ongoingGameData: Game[]
}

class OnGoingArena extends Component<ArenaProps> {

  render() {
    return (
      <div className="arenaContainer">
        <BottomBorderDivider label="ON GOING ARENA" />
        <div className="arenas">
          {this.props.ongoingGameData.map((game) => <ArenaCard gameData={game} />)}
        </div>
      </div>
    );
  }
}

export default OnGoingArena;