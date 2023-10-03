// Main.tsx
import { h, Component, createContext } from 'preact';
import { Router, Route } from 'preact-router';

import HomePage from './HomePage';
import GamePage from './GamePage';

class Main extends Component {
  render() {

    return (
      <Router>
        <Route default path="/" component={HomePage} />
        <Route path="/game" component={GamePage} />
      </Router>
    );
  }
}

export { Main };