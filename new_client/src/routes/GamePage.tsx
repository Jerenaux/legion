// GamePage.tsx
import { h, Component } from 'preact';
import { GameHUD } from '../components/game/HUD/GameHUD';
import { startGame } from '../components/game/game';

class GamePage extends Component {
  componentDidMount() {
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