// GameHUD.tsx
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { EventEmitter } from 'eventemitter3';

interface State {
  playerVisible: boolean;
  player: any;
  clickedItem: number;
  clickedSpell: number;
  overview: any;
}

const events = new EventEmitter();

class GameHUD extends Component<{}, State> {
  state: State = { 
    playerVisible: false,
    player: null,
    clickedItem: -1,
    clickedSpell: -1,
    overview: null,
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

  updateOverview = (overview: any) => {
    this.setState({ overview });
  }

  keyPress = (key: string) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, overview } = this.state;
    return (
      <div>
        <div className="hud-container">
          {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : <div className="flex-grow" />}
          <Overview overview={overview} />
        </div>
        <div id="scene"></div>
      </div>
    );
  }
}

export { GameHUD, events }