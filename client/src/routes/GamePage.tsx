import { h, Component } from 'preact';
import { GameHUD } from '../components/HUD/GameHUD';
import { startGame } from '../game/game';

interface GamePageProps {
  matches: {
    id?: string;
  };
}

interface GamePageState {
  mainDivClass: string;
}

class GamePage extends Component<GamePageProps, GamePageState> {
  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      mainDivClass: 'normalCursor'
    };
  }

  componentDidMount() {
    startGame();
  }

  changeMainDivClass = (newClass: string) => {
    this.setState({ mainDivClass: newClass });
  }

  render() {
    return (
      <div className={this.state.mainDivClass}>
        <GameHUD changeMainDivClass={this.changeMainDivClass} />
        <div id="scene" />
      </div>
    )
  }
}

export default GamePage;