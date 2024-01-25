// PlayPage.tsx
import { h, Component } from 'preact';
import Roster from './Roster';
import Button from './Button';

/* eslint-disable react/prefer-stateless-function */
class PlayPage extends Component {
  render() {

    return (
        <div className="play-content">
          <Roster />
          <div className="section-title">Game Modes</div>
          <Button label="VS AI" to="/game" />
        </div>
      );
  }
}

export default PlayPage;