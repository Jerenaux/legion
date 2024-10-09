// import { h, Component, Fragment } from 'preact';
// import { route } from 'preact-router';
// import { GameHUD, events } from '../components/HUD/GameHUD';
// import { QueueTips } from '../components/queueTips/QueueTips';
// import { startGame } from '../game/game';
// import './GamePage.style.css';

// interface GamePageProps {
//   matches: {
//     id?: string;
//   };
// }

// interface GamePageState {
//   mainDivClass: string;
//   loading: boolean;
//   initialized: boolean;
//   progress: number;
//   isPortraitMode: boolean;
// }

// class GamePage extends Component<GamePageProps, GamePageState> {
//   constructor(props: GamePageProps) {
//     super(props);
//     this.state = {
//       mainDivClass: 'normalCursor',
//       progress: 0,
//       loading: true,
//       initialized: false,
//       isPortraitMode: false,
//     };
//   }

//   componentDidMount() {
//     startGame();

//     events.on('progressUpdate', (progress: number) => {
//       this.updateProgress(progress);
//     });

//     events.on('gameInitialized', () => {
//       this.setState({ initialized: true });
//     });

//     events.on('serverDisconnect', () => {
//       console.log(`[GamePage:serverDisconnect] Server disconnected`);
//     });

//     this.checkOrientation();
//     window.addEventListener('resize', this.checkOrientation);
//     window.addEventListener('orientationchange', this.checkOrientation);
//   }

//   componentWillUnmount() {
//     window.removeEventListener('resize', this.checkOrientation);
//     window.removeEventListener('orientationchange', this.checkOrientation);
//   }

//   checkOrientation = () => {
//     this.setState({ isPortraitMode: window.matchMedia('(orientation: portrait)').matches });
//   };

//   changeMainDivClass = (newClass: string) => {
//     this.setState({ mainDivClass: newClass });
//   };

//   updateProgress = (progress: number) => {
//     this.setState({ progress, loading: progress !== 100 });
//   };

//   render() {
//     return (
//       <Fragment>
//         <div className={this.state.mainDivClass}>
//           <GameHUD changeMainDivClass={this.changeMainDivClass} />
//           <div id="scene" />
//           {this.state.loading && (
//             <div className="loading-div">
//               <div className="loading-game-spinner">
//                 <div className="spinner"></div>
//                 <div className="loading-text">{this.state.progress}%</div>
//               </div>
//             </div>
//           )}
//           {!this.state.loading && !this.state.initialized && (
//             <div className='waiting-container'>
//               <div className='waiting-div'>Waiting for server ...</div>
//               <QueueTips />
//             </div>
//           )}
//         </div>
//         {this.state.isPortraitMode && <OrientationOverlay />}
//       </Fragment>
//     );
//   }
// }

// function OrientationOverlay() {
//   return (
//     <div className="orientation-overlay">
//       <p className="orientation-overlay__text">Please rotate your device to landscape mode</p>
//     </div>
//   );
// }

// export default GamePage;

import { h, Component, Fragment } from 'preact';
import { route } from 'preact-router';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { QueueTips } from '../components/queueTips/QueueTips';
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
  initialized: boolean;
  progress: number;
  isPortraitMode: boolean;
  key: number;
}

class GamePage extends Component<GamePageProps, GamePageState> {
  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      mainDivClass: 'normalCursor',
      progress: 0,
      loading: true,
      initialized: false,
      isPortraitMode: false,
      key: 0,
    };
  }

  componentDidMount() {
    this.initializeGame();
  }

  componentWillUnmount() {
    this.cleanup();
  }

  initializeGame = () => {
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
  }

  checkOrientation = () => {
    this.setState({ isPortraitMode: window.matchMedia('(orientation: portrait)').matches });
  };

  changeMainDivClass = (newClass: string) => {
    this.setState({ mainDivClass: newClass });
  };

  updateProgress = (progress: number) => {
    console.log(`[GamePage:updateProgress] Progress: ${progress}`);
    if (this.state.progress === 100) return;
    this.setState({ progress, loading: progress !== 100 });
  };

  handleGameInitialized = () => {
    this.setState({ initialized: true });
  };

  handleServerDisconnect = () => {
    console.log(`[GamePage:serverDisconnect] Server disconnected`);
    
    if (window.location.pathname.includes('tutorial')) {
      // If in tutorial, remount the component
      this.setState(prevState => ({ key: prevState.key + 1 }), () => {
        this.cleanup();
        this.initializeGame();
      });
    } else {
      if (process.env.NODE_ENV === 'development') return;
      // If not in tutorial, route to home page
      route('/');
    }
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