// Button.tsx
import { h, Component } from 'preact';
import './UserInfoBar.style.css';

interface BarProps {
    elo?: number;
    label: string;
  }

class UserInfoBar extends Component<BarProps> {

  render() {
    return (
      <div className="barContainer">
        <div className={`barLogo ${this.props.elo ? 'eloBorder' : ''}`}></div>
        <div className="labelContainer">
          <span>{this.props.label}</span>
          {this.props.elo && <span className="eloSpan">{this.props.elo} <strong>elo</strong></span>}
        </div>
      </div>
    );
  }
}

export default UserInfoBar;