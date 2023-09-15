// Main.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import HomePage from './HomePage';
import GamePage from './GamePage';
import LandingPage from './LandingPage';

class Main extends Component {
  render() {
    return (
      <Router>
        <Route path="/" component={LandingPage} />
        <Route path="/home" component={HomePage} />
        <Route path="/play" component={HomePage} />
        <Route path="/team" component={HomePage} />
        <Route path="/shop" component={HomePage} />
        <Route path="/rank" component={HomePage} />
        <Route path="/game" component={GamePage} />
      </Router>
    );
  }
}

export { Main };