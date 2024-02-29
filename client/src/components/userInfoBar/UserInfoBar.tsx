// Button.tsx
import { h, Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';

interface BarProps {
    elo?: number;
    label: string;
  }

class UserInfoBar extends Component<BarProps> {

  render() {
    return (
      <div className="userInfoBar">
        <div className={`barLogo ${this.props.elo ? 'eloBorder' : ''}`}>
          {!this.props.elo && <img src={GoldIcon} alt="gold_icon" />}
        </div>
        <div className="userInfoLabel">
          <span>{this.props.label}</span>
          {this.props.elo && <span className="eloSpan">{this.props.elo} <strong>elo</strong></span>}
        </div>
      </div>
    );
  }
}

export default UserInfoBar;