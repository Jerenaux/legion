// App.js
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import { EventEmitter } from 'eventemitter3';

const events = new EventEmitter();
class App extends Component {
  state = { 
    visible: false,
    player: null,
  }

  componentDidMount() {
    events.on('showPlayerBox', this.showPlayerBox);
    events.on('hidePlayerBox', this.hidePlayerBox);
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

  render() {
    const { playerVisible, player } = this.state;
    return playerVisible && player ? <PlayerTab player={player} /> : null;
  }
}

const root = document.getElementById('root');
render(<App />, root);

export { App, events }
