// GameHUD.tsx
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import SpectatorFooter from './SpectatorFooter';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseItem } from '@legion/shared/BaseItem';

export interface Player {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  cooldown: number;
  maxCooldown: number;
  casting: boolean;
  portrait: string;
  number: number;
  name: string;
  spells: BaseSpell[];
  items: BaseItem[];
}

interface Team {
  members: any[];
  player: Player;
  score: number;
}

interface State {
  playerVisible: boolean;
  player: any;
  clickedItem: number;
  clickedSpell: number;
  team1: Team;
  team2: Team;
  gameOver: boolean;
  isWinner: boolean;
  xpReward: number;
  goldReward: number;
  isTutorial: boolean;
  isSpectator: boolean;
}

const events = new EventEmitter();

class GameHUD extends Component<object, State> {
  state: State = {
    playerVisible: false,
    player: null,
    clickedItem: -1,
    clickedSpell: -1,
    team1: null,
    team2: null,
    isWinner: false,
    gameOver: false,
    isTutorial: false,
    isSpectator: false,
    xpReward: 0,
    goldReward: 0,
  }

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('hidePlayerBox', this.hidePlayerBox);
    events.on('keyPress', this.keyPress);
    events.on('updateOverview', this.updateOverview);
    events.on('gameEnd', this.endGame);
  }

  componentWillUnmount() {
    events.off('showPlayer', this.showPlayerBox);
    events.off
  }

  showPlayerBox = (playerData: any) => {
    this.setState({ playerVisible: true, player: playerData });
  }

  hidePlayerBox = () => {
    this.setState({ playerVisible: false, player: null });
  }

  updateOverview = (team1: Team, team2: Team, general: any) => {
    this.setState({ team1, team2 });
    this.setState({ isTutorial: general.isTutorial, isSpectator: general.isSpectator })
  }

  endGame = (isWinner, xp, gold) => {
    this.setState({ 
      gameOver: true,
      isWinner,
      xpReward: xp,
      goldReward: gold,
    });
  }

  keyPress = (key: string) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, team1, team2, isTutorial, isSpectator } = this.state;

    return (
      <div className="height_full flex flex_col justify_between padding_bottom_16">
        <div className="hud-container">
          <Overview position="left" isSpectator={isSpectator} selectedPlayer={player} {...team2} />
          {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
          <Overview position="right" isSpectator={isSpectator} selectedPlayer={player} {...team1} />
        </div>
        {team1 && <SpectatorFooter />}
        {this.state.gameOver && <Endgame isWinner={this.state.isWinner} xpReward={this.state.xpReward} goldReward={this.state.goldReward} />}
      </div>
    );
  }
}

export { GameHUD, events }