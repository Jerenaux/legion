import { h, Component } from 'preact';
import Confetti from 'react-confetti';

import { ChestReward, RewardType } from "@legion/shared/chests";
import { ChestColor } from "@legion/shared/enums";
import { mapFrameToCoordinates } from '../utils';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';
import goldIcon from '@assets/gold_icon.png';

import bronzeChest from '@assets/shop/bronze_chest.png';
import silverChest from '@assets/shop/silver_chest.png';
import goldChest from '@assets/shop/gold_chest.png';
import shineBg from '@assets/game_end/shine_bg.png';

interface OpenedChestProps {
    width: number;
    height: number;
    color: ChestColor;
    content: ChestReward[];
    onClick: () => void;
}

class OpenedChest extends Component<OpenedChestProps> {
  constructor(props) {
    super(props);
  }

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

  getChestImage(color: ChestColor) {
    switch (color) {
        case ChestColor.BRONZE:
            return bronzeChest;
        case ChestColor.SILVER:
            return silverChest;
        case ChestColor.GOLD:
            return goldChest;
    }
  }

  render() {
    return (
      <div style={{top: `${document.documentElement.scrollTop}px`, overflow: "hidden", zIndex: "9999999999"}} className="light_streak_container">
        <div className="light_streak" style={{ width: this.props.width * 0.5 }}>
          <Confetti
            width={this.props.width * 0.5}
            height={this.props.height}
          />
          <div className="light_streak_chest">
            <img src={this.getChestImage(this.props.color)} alt="" />
          </div>
          <div className="light_shining_bg">
            <img src={shineBg} alt="" />
          </div>
          <div className="streak_gold_list_container">
            {this.props.content.map((reward, idx) => {
              const coordinates = mapFrameToCoordinates(reward?.frame);
              const backgroundImageUrl = this.getBgImageUrl(reward?.type);
              return (
                <div key={idx} className="streak_gold_list">
                  <div style={{
                    backgroundImage: `url(${backgroundImageUrl})`,
                    backgroundPosition: reward.type === RewardType.GOLD ? '' : `-${coordinates.x}px -${coordinates.y}px`,
                    backgroundSize: reward.type === RewardType.GOLD && '84% 100%',
                  }}></div>
                  <div className="streak_gold_list_amount">
                    {reward.amount}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="streak_cofirm_container" style={{ width: this.props.width * 0.8 }} onClick={this.props.onClick}>
            <div className="streak_confirm_btn"><span>Confirm</span></div>
          </div>
        </div>
      </div>
    );
  }
}

export default OpenedChest;