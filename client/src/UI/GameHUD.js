// App.js
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { EventEmitter } from 'eventemitter3';

const events = new EventEmitter();
class GameHUD extends Component {
  state = { 
    visible: false,
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
    events.off('showPlayer', this.showPlayer);
  }

  showPlayerBox = (playerData) => {
    this.setState({ playerVisible: true, player: playerData });
  }

  hidePlayerBox = () => {
    this.setState({ playerVisible: false, player: null });
  }

  updateOverview = (overview) => {
    this.setState({ overview });
  }

  keyPress = (key) => {
    this.setState({ clickedSpell: 0 });
  }

  render() {
    const { playerVisible, player, overview } = this.state;
    return (
      <div className="hud-container">
        {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : <div style={{flexGrow: 1}} />}
        <Overview overview={overview} />
      </div>
    );
  }
}

const root = document.getElementById('root');
render(<GameHUD />, root);

export { GameHUD, events }
