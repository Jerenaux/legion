import { h, Component, Fragment } from 'preact';
import { route } from 'preact-router';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { QueueTips } from '../components/queueTips/QueueTips';
import { startGame } from '../game/game';
import './GamePage.style.css';
import { recordLoadingStep } from '../components/utils';

interface GamePageProps {
  matches: {
    id?: string;
  };
}

interface GamePageState {
  mainDivClass: string;
  loading: boolean;
  initialized: boolean;
  progress: number;
  isPortraitMode: boolean;
  key: number;
  waitingStartTime: number | null;
}

class GamePage extends Component<GamePageProps, GamePageState> {
  private waitingTimer: number | null = null;

  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      mainDivClass: 'normalCursor',
      progress: 0,
      loading: true,
      initialized: false,
      isPortraitMode: false,
      key: 0,
      waitingStartTime: null,
    };
  }

  componentDidMount() {
    this.initializeGame();
  }

  componentWillUnmount() {
    this.cleanup();
  }

  initializeGame = () => {
    recordLoadingStep('start');
    startGame();

    events.on('progressUpdate', this.updateProgress);
    events.on('gameInitialized', this.handleGameInitialized);
    events.on('serverDisconnect', this.handleServerDisconnect);

    this.checkOrientation();
    window.addEventListener('resize', this.checkOrientation);
    window.addEventListener('orientationchange', this.checkOrientation);
  }

  cleanup = () => {
    events.off('progressUpdate', this.updateProgress);
    events.off('gameInitialized', this.handleGameInitialized);
    events.off('serverDisconnect', this.handleServerDisconnect);
    window.removeEventListener('resize', this.checkOrientation);
    window.removeEventListener('orientationchange', this.checkOrientation);
    if (this.waitingTimer) {
      clearTimeout(this.waitingTimer);
    }
  }

  checkOrientation = () => {
    this.setState({ isPortraitMode: window.matchMedia('(orientation: portrait)').matches });
  };

  changeMainDivClass = (newClass: string) => {
    this.setState({ mainDivClass: newClass });
  };

  updateProgress = (progress: number) => {
    if (this.state.progress === 100) return;
    this.setState({ progress, loading: progress !== 100 }, () => {
      if (!this.state.loading && !this.state.initialized) {
        this.startWaitingTimer();
      }
    });
  };

  handleGameInitialized = () => {
    this.setState({ initialized: true });
    if (this.waitingTimer) {
      clearTimeout(this.waitingTimer);
    }
  };

  handleServerDisconnect = () => {
    console.log(`[GamePage:serverDisconnect] Server disconnected`);
    
    if (window.location.pathname.includes('tutorial')) {
      this.setState(prevState => ({ key: prevState.key + 1 }), () => {
        this.cleanup();
        this.initializeGame();
      });
    } else {
      if (process.env.NODE_ENV === 'development') return;
      route('/');
    }
  };

  startWaitingTimer = () => {
    this.setState({ waitingStartTime: Date.now() });
    this.waitingTimer = window.setTimeout(() => {
      const waitingDuration = Date.now() - (this.state.waitingStartTime || 0);
      if (waitingDuration >= 30000) {
        console.error('Error: Server connection timeout - Waiting for server exceeded 30 seconds');
      }
    }, 30000);
  };

  render() {
    return (
      <Fragment key={this.state.key}>
        <div className={this.state.mainDivClass}>
          <GameHUD changeMainDivClass={this.changeMainDivClass} />
          <div id="scene" />
          {this.state.loading && (
            <div className="loading-div">
              <div className="loading-game-spinner">
                <div className="spinner"></div>
                <div className="loading-text">{this.state.progress}%</div>
              </div>
            </div>
          )}
          {!this.state.loading && !this.state.initialized && (
            <div className='waiting-container'>
              <div className='waiting-div'>Waiting for server ...</div>
              <QueueTips />
            </div>
          )}
        </div>
        {this.state.isPortraitMode && <OrientationOverlay />}
      </Fragment>
    );
  }
}

function OrientationOverlay() {
  return (
    <div className="orientation-overlay">
      <p className="orientation-overlay__text">Please rotate your device to landscape mode</p>
    </div>
  );
}

export default GamePage;