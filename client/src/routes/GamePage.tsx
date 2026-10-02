import {t} from '../i18n/core';
import { h } from 'preact';
import { Component, Fragment } from 'preact';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { QueueTips } from '../components/queueTips/QueueTips';
import { startGame, stopGame } from '../game/game';
import { Arena } from '../game/Arena';
import {CombatRecovery} from '../components/CombatRecovery';
import {captureException, addBreadcrumb} from '@sentry/react';
import './GamePage.style.css';
import { recordLoadingStep } from '../components/utils';
import { PlayerContext } from '../contexts/PlayerContext';
import { PlayerNetworkData } from '@legion/shared/interfaces';
import { TeamReveal } from '../components/teamReveal/TeamReveal';

interface GamePageProps {
  matches: {
    id?: string;
  };
}

interface GamePageState {
  failure: Error | null;
  reconnecting: boolean;
  waitingForPlayers: boolean;
  mainDivClass: string;
  loading: boolean;
  initialized: boolean;
  progress: number;
  isPortraitMode: boolean;
  key: number;
  waitingStartTime: number | null;
  currentMessageIndex: number;
  revealedTeam: PlayerNetworkData[] | null;
  revealedIndices: boolean[];
  allRevealed: boolean;
}

const WAITING_MESSAGES = [
  t("Waiting for server"),
  t("Preparing the arena"),
  t("Summoning your champions"),
  t("Sharpening weapons"),
];

class GamePage extends Component<GamePageProps, GamePageState> {
  static contextType = PlayerContext;
  private waitingTimer: number | null = null;
  private messageTimer: number | null = null;
  private game: ReturnType<typeof startGame> | null = null;
  private failing = false;

  constructor(props: GamePageProps) {
    super(props);
    this.state = {
      failure: null,
      reconnecting: false,
      waitingForPlayers: false,
      mainDivClass: 'normalCursor',
      progress: 0,
      loading: true,
      initialized: false,
      isPortraitMode: false,
      key: 0,
      waitingStartTime: null,
      currentMessageIndex: 0,
      revealedTeam: null,
      revealedIndices: [false, false, false],
      allRevealed: false,
    };
  }

  componentDidMount() {
    this.initializeGame();
  }

  componentWillUnmount() {
    this.cleanup();
  }

  componentDidUpdate(previousProps: GamePageProps) {
    // Preact Router can reuse this component when only the match ID changes.
    if (previousProps.matches.id !== this.props.matches.id) window.location.reload();
  }

  initializeGame = () => {
    recordLoadingStep('start');
    events.on('progressUpdate', this.updateProgress);
    events.on('gameInitialized', this.handleGameInitialized);
    events.on('combatWaiting', this.handleCombatWaiting);
    events.on('serverDisconnect', this.handleServerDisconnect);
    events.on('combatError', this.failGame);
    events.on('combatConnectionLost', this.handleConnectionLost);
    events.on('revealTeam', this.handleRevealTeam);
    events.on('notifyMatchmakerLeave', this.handleMatchmakerLeave);
    this.checkOrientation();
    window.addEventListener('resize', this.checkOrientation);
    window.addEventListener('orientationchange', this.checkOrientation);
    window.addEventListener('error', this.handleRuntimeError);
    window.addEventListener('unhandledrejection', this.handleRejection);
    this.startWaitingTimer();
    try {
      this.game = startGame();
      this.game.canvas.addEventListener('webglcontextlost', this.handleContextLoss);
    } catch (error) {
      this.failGame(error);
    }
  }

  cleanup = () => {
    // The route owns the entire engine, not just the currently running scene.
    // Dispose scene-owned listeners synchronously before another match can mount.
    const game = this.game;
    this.game = null;
    if (game) {
      game.canvas?.removeEventListener('webglcontextlost', this.handleContextLoss);
      try {
        (game.scene.getScene('Arena') as Arena | null)?.destroy();
      } catch (error) {
        captureException(error);
      } finally {
        stopGame(game);
      }
    }
    window.removeEventListener('error', this.handleRuntimeError);
    window.removeEventListener('unhandledrejection', this.handleRejection);
    events.off('combatError', this.failGame);
    events.off('combatConnectionLost', this.handleConnectionLost);
    events.off('progressUpdate', this.updateProgress);
    events.off('gameInitialized', this.handleGameInitialized);
    events.off('combatWaiting', this.handleCombatWaiting);
    events.off('serverDisconnect', this.handleServerDisconnect);
    events.off('revealTeam', this.handleRevealTeam);
    events.off('notifyMatchmakerLeave', this.handleMatchmakerLeave);
    window.removeEventListener('resize', this.checkOrientation);
    window.removeEventListener('orientationchange', this.checkOrientation);
    if (this.waitingTimer) {
      clearTimeout(this.waitingTimer);
    }
    if (this.messageTimer) clearInterval(this.messageTimer);
  }

  handleRuntimeError = (event: ErrorEvent) => {
    this.failGame(event.error ?? new Error(event.message || 'Unexpected game error'));
  };

  handleContextLoss = () => this.failGame(new Error('Combat WebGL context lost'));
  handleConnectionLost = () => {
    this.setState({reconnecting: true});
    this.startWaitingTimer();
  };
  handleRejection = (event: PromiseRejectionEvent) => this.failGame(event.reason);

  failGame = (error: unknown) => {
    if (this.failing) return;
    this.failing = true;
    captureException(error);
    try {
      this.cleanup();
    } catch (cleanupError) {
      captureException(cleanupError);
    } finally {
      this.setState({failure: error instanceof Error ? error : new Error(String(error))});
    }
  };

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
    addBreadcrumb({category: 'combat', message: 'Match initialized'});
    this.setState({ initialized: true });
    if (this.waitingTimer) {
      clearTimeout(this.waitingTimer);
    }
  };

  handleCombatWaiting = (waitingForPlayers: boolean) => this.setState({waitingForPlayers});

  handleRevealTeam = (team: PlayerNetworkData[]) => {
    this.setState({ revealedTeam: team });
  };

  endReveal = () => {
    events.emit('teamRevealed');
    this.setState({ revealedTeam: null });
  };

  handleServerDisconnect = () => {
    console.log(`[GamePage:serverDisconnect] Server disconnected`);

    this.failGame(new Error('Connection to the match was interrupted'));
  };

  handleMatchmakerLeave = () => {
    const gameId = this.props.matches.id;
    this.context.notifyLeaveGame(gameId);
  };

  startWaitingTimer = () => {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    this.setState({ waitingStartTime: Date.now() });
    this.startMessageRotation();
    this.waitingTimer = window.setTimeout(() => {
      this.failGame(new Error('Arena loading timed out after 30 seconds'));
    }, 30000);
  };

  startMessageRotation = () => {
    if (this.messageTimer) clearInterval(this.messageTimer);
    this.messageTimer = window.setInterval(() => {
      this.setState(prevState => ({
        currentMessageIndex: (prevState.currentMessageIndex + 1) % WAITING_MESSAGES.length
      }));
    }, 3000);
  };

  render() {
    if (this.state.failure) return <CombatRecovery error={this.state.failure} />;
    return (
      <Fragment key={this.state.key}>
        <div className={this.state.mainDivClass}>
          <GameHUD changeMainDivClass={this.changeMainDivClass} />
          <div id="scene" />
          {this.state.loading && (
            <div className="loading-div">
              <div className="loading-game-spinner">
                <div className="game-spinner"></div>
                <div className="loading-text">{this.state.progress}%</div>
              </div>
            </div>
          )}
          {!this.state.loading && (!this.state.initialized || this.state.reconnecting) && (
            <div className='waiting-container'>
              <div className='waiting-div'>{this.state.reconnecting ? t("Reconnecting to your match") : WAITING_MESSAGES[this.state.currentMessageIndex]}</div>
              <QueueTips />
            </div>
          )}
          {this.state.revealedTeam && (
            <TeamReveal
              team={this.state.revealedTeam}
              onComplete={this.endReveal}
            />
          )}
          {/* {this.state.initialized && this.state.waitingForPlayers && !this.state.revealedTeam && (
            <div className="match-ready-status" role="status">Preparing the match — waiting for everyone to be ready</div>
          )} */}
        </div>
        {this.state.isPortraitMode && <OrientationOverlay />}
      </Fragment>
    );
  }
}

function OrientationOverlay() {
  return (
    <div className="orientation-overlay">
      <p className="orientation-overlay__text">{t("Please rotate your device to landscape mode")}</p>
    </div>
  );
}

export default GamePage;
