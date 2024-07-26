// GameHUD.tsx
import { h, Component } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';
import { CharacterUpdate, GameOutcomeReward, OutcomeData, PlayerProps, TeamOverview } from "@legion/shared/interfaces";
import SpectatorFooter from './SpectatorFooter';

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
  characters: CharacterUpdate[];
  isTutorial: boolean;
  isSpectator: boolean;
  grade: string;
  chests: GameOutcomeReward[];
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
    characters: [],
    grade: null,
    chests: [],
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
    const {isWinner, xp, gold, grade, chests, characters} = data;
    this.setState({ 
      gameOver: true,
      isWinner,
      grade: grade,
      xpReward: xp,
      goldReward: gold,
      characters: characters,
      chests: chests
    });
  }

  keyPress = (key: string) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, team1, team2, isTutorial, isSpectator } = this.state; 
    console.log('team1 -> ', team1);
    console.log('team2 -> ', team2);
    const members = team1?.members[0].isPlayer ? team1?.members : team2?.members; 
    const score = team1?.members[0].isPlayer? team1?.score : team2?.score; 
    console.log('score -> ', score);

    return (
      <div className="height_full flex flex_col justify_between padding_bottom_16">
        <div className="hud-container">
          <Overview position="left" isSpectator={isSpectator} selectedPlayer={player} {...team2} />
          {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
          <Overview position="right" isSpectator={isSpectator} selectedPlayer={player} {...team1} />
        </div>
        {team1 && <SpectatorFooter isTutorial={isTutorial} score={score} />}
        {this.state.gameOver && <Endgame 
          members={members} 
          grade={this.state.grade}
          chests={this.state.chests}
          isWinner={this.state.isWinner} 
          xpReward={this.state.xpReward} 
          goldReward={this.state.goldReward} 
          characters={this.state.characters}
        />}
      </div>
    );
  }
}

export { GameHUD, events }