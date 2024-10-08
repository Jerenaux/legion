import './PlayModes.style.css'
import { h, Component } from 'preact';
import PlayModeButton from '../playModeButton/playModeButton';
import { PlayMode } from '@legion/shared/enums';

enum MiddleBtns {
  PRACTICE = 'practice',
  CASUAL = 'casual',
  RANKED = 'ranked'
}

class PlayModes extends Component {
  render() {
    return (
      <div className="barContainer">
        <PlayModeButton label={MiddleBtns.PRACTICE} mode={PlayMode.PRACTICE}/>
        <PlayModeButton label={MiddleBtns.CASUAL} players={Math.floor(Math.random() * 4) + 1} mode={PlayMode.CASUAL}/>
        <PlayModeButton label={MiddleBtns.RANKED} players={Math.floor(Math.random() * 2) + 1} mode={PlayMode.RANKED}/>
      </div>
    );
  }
}

export default PlayModes;