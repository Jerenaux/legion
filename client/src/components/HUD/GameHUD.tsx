// GameHUD.tsx
import { h, Fragment, Component } from 'preact';
import { route } from 'preact-router';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { CharacterUpdate, GameOutcomeReward, OutcomeData, PlayerProps, TeamOverview } from "@legion/shared/interfaces";
import Timeline from './Timeline';
import { PlayMode, ChestColor } from '@legion/shared/enums';
import { recordCompletedGame } from '../utils';
import TutorialDialogue from './TutorialDialogue';
import { CircularTimer } from './CircularTimer';
import PlayerBar from './PlayerBar';


interface GameHUDProps {
  changeMainDivClass: (newClass: string) => void;
}
interface GameHUDState {
  playerVisible: boolean;
  player: PlayerProps;
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
  mode: PlayMode;
  game0: boolean;
  grade: string;
  chests: GameOutcomeReward[];
  key: ChestColor;
  gameInitialized: boolean;
  tutorialMessages: string[];
  isTutorialVisible: boolean;
  showTopMenu: boolean;
  showOverview: boolean;
  queue: any[];
  turnDuration: number;
  timeLeft: number;
  turnNumber: number;
  tutorialPosition: 'bottom' | 'spells' | 'items';
  animate: boolean;
}

const events = new EventEmitter();

class GameHUD extends Component<GameHUDProps, GameHUDState> {

  getInitialState = () => ({
    playerVisible: false,
    player: null,
    pendingSpell: false,
    pendingItem: false,
    team1: null,
    team2: null,
    isWinner: false,
    gameOver: false,
    isSpectator: false,
    mode: null,
    game0: false,
    xpReward: 0,
    goldReward: 0,
    characters: [],
    grade: null,
    chests: [],
    key: null,
    gameInitialized: false,
    tutorialMessages: [],
    isTutorialVisible: true,
    showTopMenu: false,
    showOverview: false,
    queue: [],
    timeLeft: 0,
    turnNumber: 0,
    turnDuration: 0,
    animate: false,
    tutorialPosition: 'bottom' as const,
  });

  state = this.getInitialState();

  lastPlayerKey = null;

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('refreshOverview', this.updateOverview);
    events.on('gameEnd', this.endGame);
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
      this.setState({ pendingSpell: true, pendingItem: false });
      this.handleCursorChange('spellCursor')
    });

    events.on('pendingItem', () => {
      this.setState({ pendingSpell: false, pendingItem: true });
      this.handleCursorChange('itemCursor')
    });

    events.on('clearPendingSpell', () => {
      this.setState({ pendingSpell: false });
      this.handleCursorChange('normalCursor')
    });

    events.on('clearPendingItem', () => {
      this.setState({ pendingItem: false });
      this.handleCursorChange('normalCursor')
    });

    // Add a new event listener for tutorial messages
    events.on('showTutorialMessage', this.handleTutorialMessage);
    events.on('hideTutorialMessage', this.hideTutorialMessage);
    // Add new event listener for revealing top menu
    events.on('revealTopMenu', this.revealTopMenu);
    events.on('revealOverview', this.revealOverview);
  }

  componentWillUnmount() {
    events.removeAllListeners();
  }

  showPlayerBox = (playerData: PlayerProps) => {
    const playerKey = `${playerData.team}-${playerData.number}`;
    const isCharacterSwitch = this.lastPlayerKey !== playerKey;
    this.lastPlayerKey = playerKey;
    
    this.setState({ 
      player: playerData,
      animate: !isCharacterSwitch
    });
  }

  updateOverview = (
    team1: TeamOverview, team2: TeamOverview, general: any, initialized: boolean, 
    queue: any[], turnee: any
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

  handleTutorialMessage = (message: any) => {
    this.setState({
        tutorialMessages: [message.content],
        isTutorialVisible: true,
        tutorialPosition: message.position || 'bottom'
    });
  }

  hideTutorialMessage = () => {
    this.setState({ isTutorialVisible: false });
  }

  revealTopMenu = () => {
    this.setState({ showTopMenu: true });
  }

  revealOverview = () => {
    this.setState({ showOverview: true });
  }

  render() {
    const { 
      player, team1, team2, isSpectator, mode, gameInitialized, showTopMenu,
      showOverview
    } = this.state;
    const ownMembers = team1?.members[0]?.isPlayer ? team1?.members : team2?.members;
    const score = team1?.members[0]?.isPlayer ? team1?.score : team2?.score;

    if (!gameInitialized) {
      return null;
    }

    const isTutorialMode = mode === PlayMode.TUTORIAL;

    const showEnemyTurnBanner = !player?.isPlayer && gameInitialized && !this.state.gameOver;

    return (
      <div className="gamehud height_full flex flex_col justify_between padding_bottom_16">
        <>
          {showOverview && (
            <div className="hud-container">
              <Overview position="left" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team1} />
              <Overview position="right" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team2} />
            </div>
          )}
           {showTopMenu && player?.isPlayer ? (
            <>
              {player.pendingSpell == undefined && player.pendingItem == undefined && (
                <div class="player_turn_banner_container">
                  <div class="player_turn_banner">
                    <div class="player_turn_banner_particles" />
                    Your Turn!
                  </div>
                  <CircularTimer 
                    turnDuration={this.state.turnDuration}
                    timeLeft={this.state.timeLeft}
                    turnNumber={this.state.turnNumber}
                    key={`${player.team}-${player.number}`}
                  />
                </div>
              )}
              <PlayerTab 
                player={player} 
                eventEmitter={events} 
                isTutorial={isTutorialMode} 
              />
            </>
          ) : null}
        </>
        <PlayerBar 
          hp={player?.hp || 0}
          maxHp={player?.maxHp || 0}
          mp={player?.mp || 0}
          maxMp={player?.maxMp || 0}
          hasSpells={player?.spells?.length > 0}
          statuses={player?.statuses}
          isPlayerTurn={player?.isPlayer}
          turnDuration={this.state.turnDuration}
          timeLeft={this.state.timeLeft}
          turnNumber={this.state.turnNumber}
          onPassTurn={() => events.emit('passTurn')}
          animate={this.state.animate}
          pendingItem={player?.pendingItem}
          pendingSpell={player?.pendingSpell}
          items={player?.items}
          spells={player?.spells}
          eventEmitter={events}
        />
        <Timeline
          isTutorial={isTutorialMode}
          score={score}
          mode={mode}
          closeGame={this.closeGame}
          queue={this.state.queue}
          isPlayer={player?.isPlayer}
          team1={team1}
          team2={team2}
        />
        {this.state.gameOver && <Endgame
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
        {this.state.isTutorialVisible && this.state.tutorialMessages.length > 0 && (
          <TutorialDialogue
            messages={this.state.tutorialMessages}
            position={this.state.tutorialPosition}
          />
        )}
      </div>
    );
  }
}

export { GameHUD, events }
