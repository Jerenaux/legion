import './PlayModes.style.css'
import { h, Component } from 'preact';
import PlayModeButton from '../playModeButton/playModeButton';

enum MiddleBtns {
  PRACTICE = 'practice',
  CASUAL = 'casual',
  RANKED = 'ranked'
}

class PlayModes extends Component {
  render() {
    return (
      <div className="barContainer">
        <PlayModeButton label={MiddleBtns.PRACTICE} />
        <PlayModeButton label={MiddleBtns.CASUAL} players={15} />
        <PlayModeButton label={MiddleBtns.RANKED} players={8} />
      </div>
    );
  }
}

export default PlayModes;