// GameHUD.tsx
import { h, Component } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { OutcomeData, PlayerProps, TeamOverview } from "@legion/shared/interfaces";

interface State {
  playerVisible: boolean;
  player: PlayerProps;
  clickedItem: number;
  clickedSpell: number;
  team1: TeamOverview;
  team2: TeamOverview;
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

  showPlayerBox = (playerData: PlayerProps) => {
    this.setState({ playerVisible: true, player: playerData });
  }

  hidePlayerBox = () => {
    this.setState({ playerVisible: false, player: null });
  }

  updateOverview = (team1: TeamOverview, team2: TeamOverview, general: any) => {
    this.setState({ team1, team2 });
    this.setState({ isTutorial: general.isTutorial, isSpectator: general.isSpectator })
  }

  endGame = (data: OutcomeData) => {
    const {isWinner, xp, gold} = data;
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
    console.log(team1);
    return (
      <div>
        <div className="hud-container">
            <Overview position="left" {...team2} />
            {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
            <Overview position="right" {...team1} />
        </div>
        {this.state.gameOver && <Endgame xpReward={this.state.xpReward} goldReward={this.state.goldReward} />}
      </div>
    );
  }
}

export { GameHUD, events }