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
          <span className="labelSpan">{this.props.label}</span>
          {this.props.elo && <span className="eloSpan"><strong>Elo</strong> {this.props.elo}</span>}
        </div>
      </div>
    );
  }
}

export default UserInfoBar;