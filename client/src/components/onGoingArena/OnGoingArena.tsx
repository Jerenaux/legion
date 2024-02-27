// OnGoing Arena.tsx
import './OnGoingArena.style.css';
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import ArenaCard from '../arenaCard/ArenaCard';

class OnGoingArena extends Component {

  render() {
    return (
      <div className="arenaContainer">
        <BottomBorderDivider label="ON GOING ARENA" />
        <div className="arenas">
            <ArenaCard active={true} />
            <ArenaCard active={false} />
            <ArenaCard active={false} />
        </div>
      </div>
    );
  }
}

export default OnGoingArena;