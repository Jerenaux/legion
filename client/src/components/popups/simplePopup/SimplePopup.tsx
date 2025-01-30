import { h, Component } from 'preact';
import goldChestImage from '@assets/shop/gold_chest.png';
import './SimplePopup.style.css';

interface Props {
  text: string;
  header?: string;
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
            {this.props.header && <h3 className="game-notification-header">{this.props.header}</h3>}
            <p 
              className="game-notification-text"
              dangerouslySetInnerHTML={{ __html: this.props.text }}
            />
          </div>
        </div>
      </div>
    );
  }
} 