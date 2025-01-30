import { h, Component } from 'preact';
import goldChestImage from '@assets/shop/gold_chest.png';
import goldIcon from '@assets/gold_icon.png';
import './SimplePopup.style.css';

interface Props {
  text: string;
}

export class SimplePopup extends Component<Props> {
  render() {
    return (
      <div className="game-notification">
        <div className="game-notification-content">
          <img 
            src={goldChestImage} 
            alt="Gold chest" 
            className="game-notification-icon"
          />
          <div className="game-notification-text-container">
            <p className="game-notification-text">
              {this.props.text}
            </p>
          </div>
        </div>
      </div>
    );
  }
} 