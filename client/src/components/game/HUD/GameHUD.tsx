// GameHUD.tsx
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { Endgame } from './Endgame';
import { EventEmitter } from 'eventemitter3';

interface Team {
  members: any[];
  score: number;
}

interface State {
  playerVisible: boolean;
  player: any;
  clickedItem: number;
  clickedSpell: number;
  team1: Team;
  team2: Team;
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
  }

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('hidePlayerBox', this.hidePlayerBox);
    events.on('keyPress', this.keyPress);
    events.on('updateOverview', this.updateOverview);
  }

  componentWillUnmount() {
    events.off('showPlayer', this.showPlayerBox);
  }

  showPlayerBox = (playerData: any) => {
    this.setState({ playerVisible: true, player: playerData });
  }

  hidePlayerBox = () => {
    this.setState({ playerVisible: false, player: null });
  }

  updateOverview = (team1: Team, team2: Team) => {
    this.setState({ team1, team2 });
    // console.log(`team1: `, team1);
  }

  keyPress = (key: string) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, team1, team2 } = this.state;
    const gameEnded = true;
    return (
      <div>
        <div className="hud-container">
            <Overview position="left" {...team2} />
            {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
            <Overview position="right" {...team1} />
        </div>
        {gameEnded && <Endgame />}
      </div>
    );
  }
}

export { GameHUD, events }