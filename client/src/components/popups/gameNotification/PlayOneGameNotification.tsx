import { h } from 'preact';
import { Component } from 'preact';
import goldChestImage from '@assets/shop/gold_chest.png';
import { ChestReward } from "@legion/shared/interfaces";
import { RewardType } from "@legion/shared/enums";
import { mapFrameToCoordinates } from '../../utils';
import { getRewardBgImage, getRewardObject } from '../../utils';
import './PlayOneGameNotification.style.css';

if (process.env.NODE_ENV === 'development') {
  window.addEventListener('error', (e) => {
    if (e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
    }
  });
}

interface Props {
  header: string;
  text: string;
  rewards?: ChestReward[];
  onHide?: () => void;
}

export class PlayOneGameNotification extends Component<Props> {
  renderRewards() {
    if (!this.props.rewards) return null;

    return this.props.rewards.map((reward, idx) => {
      const rewardObject = getRewardObject(reward.type, reward.id);
      const coordinates = rewardObject ? mapFrameToCoordinates(rewardObject.frame) : { x: 0, y: 0 };
      const backgroundImageUrl = getRewardBgImage(reward.type);
      return (
        <div key={idx} className="unlocked-feature-reward-item">
          <div className="unlocked-feature-reward-icon" style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundPosition: reward.type === RewardType.GOLD ? '' : `-${coordinates.x}px -${coordinates.y}px`,
            backgroundSize: reward.type === RewardType.GOLD ? '84% 100%' : 'initial',
          }}/>
          <span className="unlocked-feature-reward-amount">{reward.amount}</span>
        </div>
      );
    });
  }

  render() {
    const { header, text, rewards, onHide } = this.props;
    return (
      <div className="game-notification">
        <button type="button"
          className="game-notification-close"
          onClick={onHide}
          aria-label="Close notification"
        >
          ×
        </button>
        <div className="game-notification-content">
          <img
            src={goldChestImage}
            alt="Gold chest"
            className="game-notification-icon"
          />
          <div className="game-notification-text-container">
            <h3 className="game-notification-header">{header}</h3>
            <p className="game-notification-text"
               dangerouslySetInnerHTML={{ __html: text }}
            />
            {rewards && (
              <div className="expected-rewards-container">
                {this.renderRewards()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}