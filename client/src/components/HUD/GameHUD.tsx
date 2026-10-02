import { Fragment } from 'preact';
import { h } from 'preact';
// GameHUD.tsx
import { Component } from 'preact';
import { route } from 'preact-router';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { CharacterUpdate, GameOutcomeReward, OutcomeData, PlayerProps, TeamMember, TeamOverview, TurnQueueEntry, TurnState } from "@legion/shared/interfaces";
import Timeline from './Timeline';
import { PlayMode, ChestColor } from '@legion/shared/enums';
import { recordCompletedGame } from '../utils';
import TutorialDialogue from './TutorialDialogue';
import { combatTipsVisible, saveCombatTips, type TutorialMessage } from '../../game/TutorialManager';
import PlayerBar from './PlayerBar';
import CharacterHoverCard, { CharacterHover } from './CharacterHoverCard';


interface GameHUDProps {
  changeMainDivClass: (newClass: string) => void;
}
interface GameHUDState {
  playerVisible: boolean;
  player: PlayerProps;
  commandPlayer: PlayerProps | null;
  canCommand: boolean;
  isPlayerTurn: boolean;
  pendingSpell: boolean;
  pendingItem: boolean;
  team1: TeamOverview;
  team2: TeamOverview;
  gameOver: boolean;
  isWinner: boolean;
  xpReward: number;
  goldReward: number;
  characters: CharacterUpdate[];
  isSpectator: boolean;
  tower: {floor: number; tier: number; name: string} | null;
  mode: PlayMode;
  game0: boolean;
  grade: string;
  chests: GameOutcomeReward[];
  key: ChestColor;
  gameInitialized: boolean;
  tutorialMessage: TutorialMessage | null;
  tipsAvailable: boolean;
  actionFeedback: string;
  isTutorialVisible: boolean;
  showTopMenu: boolean;
  showOverview: boolean;
  queue: TurnQueueEntry[];
  turnDuration: number;
  timeLeft: number;
  turnNumber: number;
  isHUDVisible: boolean;
  characterHover: CharacterHover | null;
}

const events = new EventEmitter();

class GameHUD extends Component<GameHUDProps, GameHUDState> {

  getInitialState = () => ({
    playerVisible: false,
    player: null,
    commandPlayer: null,
    canCommand: false,
    isPlayerTurn: false,
    pendingSpell: false,
    pendingItem: false,
    team1: null,
    team2: null,
    gameOver: false,
    isWinner: false,
    xpReward: 0,
    goldReward: 0,
    characters: [],
    isSpectator: false,
    mode: null,
    tower: null,
    game0: false,
    grade: null,
    chests: [],
    key: null,
    gameInitialized: false,
    tutorialMessage: null,
    tipsAvailable: false,
    actionFeedback: '',
    isTutorialVisible: false,
    showTopMenu: false,
    showOverview: false,
    queue: [],
    timeLeft: 0,
    turnNumber: 0,
    turnDuration: 0,
    isHUDVisible: true,
    characterHover: null,
  });

  state = this.getInitialState();

  private lastPassTurnClick = 0;
  private feedbackTimer: ReturnType<typeof setTimeout>;
  private clearActionFeedback = () => {
    clearTimeout(this.feedbackTimer);
    this.setState({actionFeedback: ''});
  };

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('characterHoverChanged', this.onCharacterHover);
    events.on('refreshOverview', this.updateOverview);
    events.on('gameEnd', this.endGame);
    events.on('towerInfo', this.setTowerInfo);
    events.on('hoverCharacter', () => {
      if (this.state.pendingSpell || this.state.pendingItem) return;
      this.handleCursorChange('pointerCursor')
    });

    events.on('hoverEnemyCharacter', () => {
      if (this.state.pendingSpell || this.state.pendingItem) return;
      this.handleCursorChange('swordCursor')
    });

    events.on('unhoverCharacter', () => {
      if (this.state.pendingSpell || this.state.pendingItem) return;
      this.handleCursorChange('normalCursor')
    });

    events.on('pendingSpell', () => {
      this.setState({
        pendingSpell: true,
        pendingItem: false,
      });
      this.handleCursorChange('spellCursor')
    });

    events.on('pendingItem', () => {
      this.setState({
        pendingSpell: false,
        pendingItem: true,
      });
      this.handleCursorChange('itemCursor')
    });

    events.on('clearPendingSpell', () => {
      this.setState({
        pendingSpell: false,
      });
      this.handleCursorChange('normalCursor')
    });

    events.on('clearPendingItem', () => {
      this.setState({
        pendingItem: false,
      });
      this.handleCursorChange('normalCursor')
    });

    // Add a new event listener for tutorial messages
    events.on('showTutorialMessage', this.handleTutorialMessage);
    events.on('hideTutorialMessage', this.hideTutorialMessage);
    events.on('combatTipsAvailable', this.handleTipsAvailable);
    events.on('combatTipsVisibility', this.handleTipsVisibility);
    events.on('actionFeedback', this.handleActionFeedback);
    events.on('turnStarted', this.clearActionFeedback);
    for (const event of ['playerMoved', 'playerAttacked', 'playerCastSpell', 'playerUseItem']) {
      events.on(event, this.clearActionFeedback);
    }
    // Add new event listener for revealing top menu
    events.on('revealTopMenu', this.revealTopMenu);
    events.on('revealOverview', this.revealOverview);

    // Add keyboard event listener for HUD toggle
    window.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    clearTimeout(this.feedbackTimer);
    events.removeAllListeners();
    // Remove keyboard event listener
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  onCharacterHover = (characterHover: CharacterHover | null) => {
    this.setState({ characterHover });
  }

  inspectCharacter = (team: number, num: number, element: HTMLElement | null) => {
    events.emit('inspectCharacter', team, num, element?.getBoundingClientRect());
  }

  showPlayerBox = (player: PlayerProps | null, commandPlayer: PlayerProps | null, canCommand: boolean, isPlayerTurn: boolean) => {
    if (player?.team !== this.state.player?.team || player?.number !== this.state.player?.number ||
        player?.pendingSpell !== this.state.player?.pendingSpell || player?.pendingItem !== this.state.player?.pendingItem) {
      this.clearActionFeedback();
    }
    this.setState({player, commandPlayer, canCommand, isPlayerTurn});
  }

  updateOverview = (
    team1: TeamOverview,
    team2: TeamOverview,
    general: {isSpectator: boolean; mode: PlayMode; game0: boolean},
    initialized: boolean,
    queue: TurnQueueEntry[],
    turnee: TurnState,
  ) => {
    const _showTopMenu = this.state.showTopMenu;
    this.setState({ team1, team2 });
    this.setState({
        isSpectator: general.isSpectator,
        mode: general.mode,
        game0: general.game0,
        gameInitialized: initialized,
        queue,
        showTopMenu: general.mode === PlayMode.TUTORIAL ? _showTopMenu : true,
        showOverview: !general.game0,
        turnDuration: turnee.turnDuration,
        timeLeft: turnee.timeLeft,
        turnNumber: turnee.turnNumber,
    })
  }

  setTowerInfo = (tower: GameHUDState['tower']) => this.setState({tower});

  endGame = (data: OutcomeData) => {
    recordCompletedGame();
    const { isWinner, xp, gold, grade, chests, characters, key } = data;
    this.setState({
      gameOver: true,
      isWinner,
      grade: grade,
      xpReward: xp,
      goldReward: gold,
      characters: characters,
      chests: chests,
      key: key,
    });
  }

  handleCursorChange = (newCursorClass: string) => {
    this.props.changeMainDivClass(newCursorClass);
  }

  closeGame = () => {
    events.emit('exitGame');
    route('/play');
  }

  handleTutorialMessage = (tutorialMessage: TutorialMessage) => this.setState({tutorialMessage});

  handleTipsAvailable = (defaultVisible: boolean) => {
    this.setState({tipsAvailable: true, isTutorialVisible: combatTipsVisible(defaultVisible)});
  };

  handleTipsVisibility = (visible: boolean) => {
    saveCombatTips(visible);
    this.setState({isTutorialVisible: visible});
  };

  handleActionFeedback = (message: string) => {
    clearTimeout(this.feedbackTimer);
    this.setState({actionFeedback: message});
    this.feedbackTimer = setTimeout(this.clearActionFeedback, 5000);
  };

  hideTutorialMessage = () => this.setState({tutorialMessage: null});

  revealTopMenu = () => {
    this.setState({ showTopMenu: true });
  }

  revealOverview = () => {
    this.setState({ showOverview: true });
  }

  handlePassTurn = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - this.lastPassTurnClick < 200) {
      return;
    }
    this.lastPassTurnClick = now;

    if (!this.state.canCommand || this.state.pendingSpell || this.state.pendingItem) {
      return;
    }

    events.emit('passTurn');
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key.toLowerCase() === 'a') events.emit('clearCharacterHover');
    // Toggle HUD visibility when 'a' key is pressed
    if (event.key.toLowerCase() === 'a') {
      this.setState(prevState => ({ isHUDVisible: !prevState.isHUDVisible }));
    }
  }

  render() {
    const {
      player, team1, team2, isSpectator, mode, gameInitialized,
      showOverview, isHUDVisible, characterHover
    } = this.state;
    const ownMembers: TeamMember[] = team1?.members[0]?.isPlayer ? team1?.members : team2?.members;
    const score = team1?.members[0]?.isPlayer ? team1?.score : team2?.score;

    if (!gameInitialized) {
      return null;
    }

    const isTutorialMode = mode === PlayMode.TUTORIAL;
    const inspected = characterHover && (characterHover.team === 1 ? team1 : team2)?.members[characterHover.num - 1];

    return (
      <div className="gamehud height_full flex flex_col justify_between padding_bottom_16"
        data-coach-focus={isHUDVisible && !this.state.gameOver && this.state.isTutorialVisible ? this.state.tutorialMessage?.focus : undefined}>
        {isHUDVisible && (
          <>
            {showOverview && (
              <div className="hud-container">
                <Overview teamId={1} characterHover={characterHover} onInspect={this.inspectCharacter} position="left" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team1} />
                <Overview teamId={2} characterHover={characterHover} onInspect={this.inspectCharacter} position="right" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team2} />
              </div>
            )}
          </>
        )}
        {this.state.tower && <div className="tower-combat-banner" role="status">
          <span>Floor</span> <strong>{this.state.tower.floor}</strong>
        </div>}
        {isHUDVisible && (
          <PlayerBar
            player={this.state.commandPlayer}
            canAct={this.state.canCommand}
            isPlayerTurn={this.state.isPlayerTurn}
            turnDuration={this.state.turnDuration}
            timeLeft={this.state.timeLeft}
            turnNumber={this.state.turnNumber}
            onPassTurn={this.handlePassTurn}
            eventEmitter={events}
          />
        )}
        {isHUDVisible && (
          <Timeline
            characterHover={characterHover}
            onInspect={this.inspectCharacter}
            isTutorial={isTutorialMode}
            score={score}
            mode={mode}
            closeGame={this.closeGame}
            queue={this.state.queue}
            isPlayer={player?.isPlayer}
            team1={team1}
            team2={team2}
          />
        )}
        {isHUDVisible && !this.state.gameOver && inspected && <CharacterHoverCard character={inspected} hover={characterHover} />}
        {isHUDVisible && this.state.gameOver && <Endgame
          members={ownMembers}
          grade={this.state.grade}
          chests={this.state.chests}
          isWinner={this.state.isWinner}
          xpReward={this.state.xpReward}
          goldReward={this.state.goldReward}
          characters={this.state.characters}
          chestKey={ChestColor.SILVER}
          game0={this.state.game0}
          mode={mode}
          closeGame={this.closeGame}
          eventEmitter={events}
        />}
        {isHUDVisible && !this.state.gameOver && this.state.tipsAvailable && (
          <TutorialDialogue
            message={this.state.tutorialMessage}
            visible={this.state.isTutorialVisible}
            onToggle={() => this.handleTipsVisibility(!this.state.isTutorialVisible)}
            feedback={this.state.actionFeedback}
          />
        )}
      </div>
    );
  }
}

export { GameHUD, events }
