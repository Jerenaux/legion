// App.js
import { h, Component, render } from 'preact';
import AliveCount from './AliveCount';

class App extends Component {
  state = { aliveCount: 0 }

  setAliveCount = (count) => {
    this.setState({ aliveCount: count });
  }

  render() {
    return <AliveCount count={this.state.aliveCount} />;
  }
}

const root = document.getElementById('root');
render(<App />, root);

export default App;
