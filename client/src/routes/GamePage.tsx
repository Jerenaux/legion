// GamePage.tsx
import { h, Component } from 'preact';
import { GameHUD } from '../components/game/HUD/GameHUD';
import { startGame } from '../components/game/game';

interface GamePageProps {
  matches: {
    id?: string;
  };
}

class GamePage extends Component<GamePageProps, {}> {
  componentDidMount() {
    // this.props.matches.id)
    startGame();
  }

  render() {
    return (
      <div>
        <GameHUD />
        <div id="scene" />
      </div>
    )
  }
}

export default GamePage;