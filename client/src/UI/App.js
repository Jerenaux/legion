// App.js
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import Overview from './Overview';
import { EventEmitter } from 'eventemitter3';

const events = new EventEmitter();
class App extends Component {
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
      <div className="app-container">
          {playerVisible && player ? <PlayerTab player={player} eventEmitter={events} /> : null}
          <Overview overview={overview} />
      </div>
  );
  }
}

const root = document.getElementById('root');
render(<App />, root);

export { App, events }
