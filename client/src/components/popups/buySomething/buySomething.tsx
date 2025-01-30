import { h, Component } from 'preact';
import goldChestImage from '@assets/shop/gold_chest.png';
import './BuySomething.style.css';

export class BuySomething extends Component {
  render() {
    return (
      <div className="game-notification">
        <div className="game-notification-content">
          <img 
            src={goldChestImage} 
            className="game-notification-icon"
          />
          <div className="game-notification-text-container">
            <h3 className="game-notification-header">Your first purchase</h3>
            <p className="game-notification-text">
              Click on the <span className="highlight-text">Potion</span> to buy one!
            </p>
          </div>
        </div>
      </div>
    );
  }
} 