import { h, Fragment, Component } from 'preact';
import { route } from 'preact-router';
import { ChestReward, RewardType } from "@legion/shared/chests";
import { mapFrameToCoordinates } from '../../utils';
import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';
import goldIcon from '@assets/gold_icon.png';
import './UnlockedFeature.style.css';

interface Props {
  name: string;
  description: string;
  rewards: ChestReward[];
  route?: string;
  onHide: () => void;
}

export class UnlockedFeature extends Component<Props> {
  getBgImageUrl(rewardType: RewardType) {
    switch (rewardType) {
      case RewardType.EQUIPMENT:
        return equipmentSpritesheet;
      case RewardType.SPELL:
        return spellsSpritesheet;
      case RewardType.CONSUMABLES:
        return consumablesSpritesheet;
      case RewardType.GOLD:
        return goldIcon;
    }
  }

  renderRewards() {
    return this.props.rewards.map((reward, idx) => {
      const coordinates = mapFrameToCoordinates(reward?.frame);
      const backgroundImageUrl = this.getBgImageUrl(reward?.type);
      return (
        <div key={idx} className="unlocked-reward-item">
          <div className="unlocked-reward-icon" style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundPosition: reward.type === RewardType.GOLD ? '' : `-${coordinates.x}px -${coordinates.y}px`,
            backgroundSize: reward.type === RewardType.GOLD ? '84% 100%' : 'initial',
          }}/>
          <span className="unlocked-reward-amount">{reward.amount}</span>
        </div>
      );
    });
  }

  handleCheckout = () => {
    if (this.props.route) {
      route(this.props.route);
    }
    this.props.onHide();
  };

  render() {
    const { name, description, route } = this.props;

    return (
      <div className="unlocked-feature">
        <div className="unlocked-feature-content">
          <h2 className="unlocked-feature-header">
            You unlocked <span className="highlight-text">{name}</span>!
          </h2>
          <p className="unlocked-feature-description">{description}</p>
          
          {/* <p className="unlocked-feature-rewards-header">
            You also earned:
          </p> */}
          <div className="unlocked-rewards-container">
            {this.renderRewards()}
          </div>

          <div className="unlocked-feature-buttons">
            {route ? (
              <>
                <button 
                  className="unlocked-feature-button primary" 
                  onClick={this.handleCheckout}
                >
                  Check it out
                </button>
                <button 
                  className="unlocked-feature-button secondary" 
                  onClick={this.props.onHide}
                >
                  Dismiss
                </button>
              </>
            ) : (
              <button 
                className="unlocked-feature-button primary" 
                onClick={this.props.onHide}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
} 