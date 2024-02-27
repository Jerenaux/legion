// Middle Bar.tsx
import './MiddleBar.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import MiddleButton from '../middleButton/middleButton';

enum MiddleBtns {
  PRACTICE = 'practice',
  CASUAL = 'casual',
  RANKED = 'ranked'
}

class MiddleBar extends Component {
  render() {
    return (
      <div className="barContainer">
        <MiddleButton label={MiddleBtns.PRACTICE} />
        <MiddleButton label={MiddleBtns.CASUAL} players={15} />
        <MiddleButton label={MiddleBtns.RANKED} players={8} />
      </div>
    );
  }
}

export default MiddleBar;