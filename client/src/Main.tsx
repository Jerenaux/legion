// Main.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import { GameHUD } from './game/HUD/GameHUD';
import { startGame } from './game/game';

class HomePage extends Component {
  render() {
    return <h1>Hello World</h1>;
  }
}

class GamePage extends Component {
  componentDidMount() {
    startGame();
  }

  render() {
    return <GameHUD />;
  }
}

class Main extends Component {
  render() {
    return (
      <Router>
        <Route path="/" component={HomePage} />
        <Route path="/game" component={GamePage} />
      </Router>
    );
  }
}

export { Main };