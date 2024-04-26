// OnGoing Arena.tsx
import './OnGoingArena.style.css';
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import ArenaCard from '../arenaCard/ArenaCard';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'

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
        </div> : <Skeleton
          height={100}
          count={1}
          highlightColor='#0000004d'
          baseColor='#0f1421'
          style={{ margin: '2px 0', width: '1024px' }} />}
      </div>
    );
  }
}

export default OnGoingArena;