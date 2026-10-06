import { h } from 'preact';
// OnGoing Arena.tsx
import './OnGoingArena.style.css';
import { Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import ArenaCard from '../arenaCard/ArenaCard';
import Ghost from '../ghost/Ghost';

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
        <BottomBorderDivider label="ONGOING GAMES" />
        {this.props.ongoingGameData ? <div className="arenas">
          {this.props.ongoingGameData.map((game) => <ArenaCard gameData={game} />)}
        </div> : <Ghost height={100} />}
      </div>
    );
  }
}

export default OnGoingArena;