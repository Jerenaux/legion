// GameHUD.tsx
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import SpectatorFooter from './SpectatorFooter';

export interface Player {
  avatar: string;
  name: string;
  level: number;
  rank: number;
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

  endGame = (xp, gold) => {
    this.setState({
      gameOver: true,
      xpReward: xp,
      goldReward: gold,
    });
  }

  keyPress = (key: string) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, team1, team2, isTutorial, isSpectator } = this.state;

    const playerData = {
      hp: 50,
      maxHp: 70,
      mp: 80,
      maxMp: 100,
      cooldown: 5,
      maxCooldown: 7,
      casting: true,
      portrait: '2_2',
      number: 2,
      name: 'player_name',
      spells: [3, 4],
      items: [1, 2]
    }

    return (
      <div className="height_full flex flex_col justify_between padding_bottom_16">
        <div className="hud-container">
          <Overview position="left" isSpectator={isSpectator} {...team2} />
          <PlayerTab player={playerData} eventEmitter={events} />
          {playerVisible && player ? <PlayerTab player={playerData} eventEmitter={events} /> : null}
          <Overview position="right" isSpectator={isSpectator} {...team1} />
        </div>
        <SpectatorFooter />
        {this.state.gameOver && <Endgame xpReward={this.state.xpReward} goldReward={this.state.goldReward} />}
      </div>
    );
  }
}

export { GameHUD, events }