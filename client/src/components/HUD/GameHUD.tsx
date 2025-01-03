// GameHUD.tsx
import { h, Fragment, Component } from 'preact';
import { route } from 'preact-router';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { CharacterUpdate, GameOutcomeReward, OutcomeData, PlayerProps, TeamOverview } from "@legion/shared/interfaces";
import SpectatorFooter from './SpectatorFooter';
import { PlayMode, ChestColor } from '@legion/shared/enums';
import { recordCompletedGame } from '../utils';
import TutorialDialogue from './TutorialDialogue';

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
  grade: string;
  chests: GameOutcomeReward[];
  key: ChestColor;
  gameInitialized: boolean;
  tutorialMessages: string[];
  isTutorialVisible: boolean;
  showTopMenu: boolean;
  showOverview: boolean;
  queue: any[];
  turnee: any;
}

const events = new EventEmitter();

class GameHUD extends Component<GameHUDProps, GameHUDState> {

  state = {
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
    turnee: null,
  } as GameHUDState;

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('hidePlayerBox', this.hidePlayerBox);
    events.on('updateOverview', this.updateOverview);
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
    // Add new event listener for revealing top menu
    events.on('revealTopMenu', this.revealTopMenu);
    events.on('revealOverview', this.revealOverview);
  }

  componentWillUnmount() {
    events.removeAllListeners();
  }

  showPlayerBox = (playerData: PlayerProps) => {
    this.setState({ playerVisible: true, player: playerData });
  }

  hidePlayerBox = () => {
    this.setState({ playerVisible: false, player: null });
  }

  updateOverview = (
    team1: TeamOverview, team2: TeamOverview, general: any, initialized: boolean, 
    queue: any[], turnee: any
  ) => {
    const _showTopMenu = this.state.showTopMenu;
    const _showOverview = this.state.showOverview;
    this.setState({ team1, team2 });
    this.setState({
        isSpectator: general.isSpectator,
        mode: general.mode,
        gameInitialized: initialized,
        queue,
        turnee,
        showTopMenu: general.mode === PlayMode.TUTORIAL ? _showTopMenu : true,
        showOverview: general.mode === PlayMode.TUTORIAL ? _showOverview : true,
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

  handleTutorialMessage = (messages: string[]) => {
    this.setState({
      tutorialMessages: messages,
      isTutorialVisible: true,
    });
  }

  revealTopMenu = () => {
    this.setState({ showTopMenu: true });
  }

  revealOverview = () => {
    this.setState({ showOverview: true });
  }

  render() {
    const { playerVisible, player, team1, team2, isSpectator, mode, gameInitialized, showTopMenu, showOverview } = this.state;
    const members = team1?.members[0].isPlayer ? team1?.members : team2?.members;
    const score = team1?.members[0].isPlayer ? team1?.score : team2?.score;

    if (!gameInitialized) {
      return null;
    }

    const isTutorialMode = mode === PlayMode.TUTORIAL;

    return (
      <div className="gamehud height_full flex flex_col justify_between padding_bottom_16">
        <>
          {showOverview && (
            <div className="hud-container">
              <Overview position="left" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team1} />
              <Overview position="right" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team2} />
            </div>
          )}
          {showTopMenu && playerVisible && player ? (
            <PlayerTab 
                player={player} 
                eventEmitter={events} 
                isTutorial={isTutorialMode} 
            />
          ) : null}
        </>
        <SpectatorFooter
          isTutorial={isTutorialMode}
          score={score}
          mode={mode}
          closeGame={this.closeGame}
          queue={this.state.queue}
          team1={team1}
          team2={team2}
        />
        {this.state.gameOver && <Endgame
          members={members}
          grade={this.state.grade}
          chests={this.state.chests}
          isWinner={this.state.isWinner}
          xpReward={this.state.xpReward}
          goldReward={this.state.goldReward}
          characters={this.state.characters}
          chestKey={ChestColor.SILVER}
          mode={mode}
          closeGame={this.closeGame}
          eventEmitter={events}
        />}
        {this.state.isTutorialVisible && this.state.tutorialMessages.length > 0 && (
          <TutorialDialogue
            messages={this.state.tutorialMessages}
          />
        )}
      </div>
    );
  }
}

export { GameHUD, events }
