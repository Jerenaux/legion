// GameHUD.tsx
import { h, Component } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { CharacterUpdate, GameOutcomeReward, OutcomeData, PlayerProps, TeamOverview } from "@legion/shared/interfaces";
import SpectatorFooter from './SpectatorFooter';
import { PlayMode, ChestColor } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { showGuideToast } from '../utils';
import { guide } from '../tips';

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
  isTutorial: boolean;
  isSpectator: boolean;
  mode: PlayMode;
  grade: string;
  chests: GameOutcomeReward[];
  key: ChestColor;
  gameInitialized: boolean;
}

const events = new EventEmitter();

class GameHUD extends Component<GameHUDProps, GameHUDState> {
  state: GameHUDState = {
    playerVisible: false,
    player: null,
    pendingSpell: false,
    pendingItem: false,
    team1: null,
    team2: null,
    isWinner: false,
    gameOver: false,
    isTutorial: false,
    isSpectator: false,
    mode: null,
    xpReward: 0,
    goldReward: 0,
    characters: [],
    grade: null,
    chests: [],
    key: null,
    gameInitialized: false,
  }

  resetState = () => {
    this.setState({
      playerVisible: false,
      player: null,
      pendingSpell: false,
      pendingItem: false,
      team1: null,
      team2: null,
      isWinner: false,
      gameOver: false,
      isTutorial: false,
      isSpectator: false,
      mode: null,
      xpReward: 0,
      goldReward: 0,
      characters: [],
      grade: null,
      chests: [],
      key: null,
      gameInitialized: false,
    });
  }

  componentDidMount() {
    this.resetState();
    apiFetch('fetchGuideTip?combatTip=1', {
        method: 'GET',
    })
    .then((data) => {
        if (data.guideId == -1) return;
        showGuideToast(guide[data.guideId], data.route);
    })
    .catch(error => console.error(`Fetching tip error: ${error}`));
    
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

  updateOverview = (team1: TeamOverview, team2: TeamOverview, general: any, initialized: boolean) => {
    this.setState({ team1, team2 });
    this.setState({ 
      isTutorial: general.isTutorial,
      isSpectator: general.isSpectator,
      mode : general.mode,
      gameInitialized: initialized
    })
  }

  endGame = (data: OutcomeData) => {
    const {isWinner, xp, gold, grade, chests, characters, key} = data;
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

  render() {
    const { playerVisible, player, team1, team2, isTutorial, isSpectator, mode, gameInitialized } = this.state; 
    const members = team1?.members[0].isPlayer ? team1?.members : team2?.members; 
    const score = team1?.members[0].isPlayer? team1?.score : team2?.score; 

    if (!gameInitialized) {
      return null; 
    }

    return (
      <div className="gameCursor height_full flex flex_col justify_between padding_bottom_16">
        <div className="hud-container">
          <Overview position="left" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team2} />
          {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
          <Overview position="right" isSpectator={isSpectator} selectedPlayer={player} eventEmitter={events} mode={mode} {...team1} />
        </div>
        {team1 && <SpectatorFooter isTutorial={isTutorial} score={score} mode={mode} />}
        {this.state.gameOver && <Endgame 
          members={members} 
          grade={this.state.grade}
          chests={this.state.chests}
          isWinner={this.state.isWinner} 
          xpReward={this.state.xpReward} 
          goldReward={this.state.goldReward} 
          characters={this.state.characters}
          chestKey={ChestColor.SILVER}
          eventEmitter={events}
        />}
      </div>
    );
  }
}

export { GameHUD, events }