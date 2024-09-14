import { h, Component } from 'preact';
import { GameHUD } from '../components/HUD/GameHUD';
import { startGame } from '../game/game';
import './GamePage.style.css';

interface GamePageProps {
  matches: {
    id?: string;
  };
}

interface GamePageState {
  mainDivClass: string;
  loading: boolean;
  progress: number;
}

class GamePage extends Component<GamePageProps, GamePageState> {
  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      mainDivClass: 'normalCursor',
      progress: 0,
      loading: true,
    };
  }

  componentDidMount() {
    startGame();
  }

  changeMainDivClass = (newClass: string) => {
    this.setState({ mainDivClass: newClass });
  }

  updateProgress = (progress: number) => {
    this.setState({ progress });
    if (progress === 100) {
      this.setState({ loading: false });
    }
  }

  render() {
    return (
      <div className={this.state.mainDivClass}>
        <GameHUD 
          changeMainDivClass={this.changeMainDivClass}
          updateProgress={this.updateProgress}
        />
        <div id="scene" />
        {this.state.loading && <div className="loading-div">
          <div className="loading-game-spinner">
            <div className="spinner"></div>
            <div className="loading-text">
              {this.state.progress}%
            </div>
          </div>
        </div>}
      </div>
    )
  }
}

export default GamePage;