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
  loading: boolean;
}

class GamePage extends Component<GamePageProps, GamePageState> {
  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      mainDivClass: 'normalCursor',
      loading: true,
    };
  }

  componentDidMount() {
    startGame();
  }

  changeMainDivClass = (newClass: string) => {
    this.setState({ mainDivClass: newClass });
  }

  markLoaded = () => {
    this.setState({ loading: false });
  }

  render() {
    return (
      <div className={this.state.mainDivClass}>
        <GameHUD changeMainDivClass={this.changeMainDivClass} markLoaded={this.markLoaded}/>
        <div id="scene" />
        {this.state.loading && <div className="loading-div">
          <div className="loading-game-spinner" />
        </div>}
      </div>
    )
  }
}

export default GamePage;