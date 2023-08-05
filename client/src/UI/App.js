// App.js
import { h, Component, render } from 'preact';
import PlayerTab from './PlayerTab';
import { EventEmitter } from 'eventemitter3';

const events = new EventEmitter();
class App extends Component {
  state = { aliveCount: 0 }

  componentDidMount() {
    events.on('updateAliveCount', this.setAliveCount);
  }

  componentWillUnmount() {
    events.off('updateAliveCount', this.setAliveCount);
  }

  setAliveCount = (count) => {
    this.setState({ aliveCount: count });
  }

  render() {
    return <PlayerTab player={{
      name: 'Player 1',
      number: 1,
      portrait: 'assets/sprites/1_1.png',
      hp: 600,
      maxHp: 1000,
      mp: 12,
      maxMp: 100,
      cooldown: 2,
      skills: [
        { name: 'Skill 1', cooldown: 10 },
        { name: 'Skill 2', cooldown: 10 },
        { name: 'Skill 3', cooldown: 10 },
        { name: 'Skill 4', cooldown: 10 },
        { name: 'Skill 5', cooldown: 10 },
      ],
      items: [
        { name: 'Item 1', quantity: 10 },
        { name: 'Item 2', quantity: 10 },
        { name: 'Item 3', quantity: 10 },
        { name: 'Item 4', quantity: 10 },
        { name: 'Item 5', quantity: 10 },
      ]
    }} />;
  }
}

const root = document.getElementById('root');
render(<App />, root);

export { App, events }
