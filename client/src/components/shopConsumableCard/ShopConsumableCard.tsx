import './ShopConsumableCard.style.css';
import { h, Component } from 'preact';
import { InventoryType, RarityColor, Target } from "@legion/shared/enums";
import { BaseItem } from '@legion/shared/BaseItem';
import { getSpeedClass, mapFrameToCoordinates } from '../utils';
import { Tooltip as ReactTooltip } from "react-tooltip";
import { Effect } from '@legion/shared/interfaces';

import consumablesSpritesheet from '@assets/consumables.png';

// Import stat icons
import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import attackIcon from '@assets/stats_icons/attack_icon.png';
import defIcon from '@assets/stats_icons/def_icon.png';
import satkIcon from '@assets/stats_icons/satk_icon.png';
import sdefIcon from '@assets/stats_icons/sdef_icon.png';
import speedIcon from '@assets/stats_icons/speed_icon.png';

// Import other icons
import itemCountIcon from '@assets/shop/item_count_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';
import goldIcon from '@assets/gold_icon.png';

export const StatIcons = [
  hpIcon,
  mpIcon,
  attackIcon,
  defIcon,
  satkIcon,
  sdefIcon,
  speedIcon,
];

interface modalData {
  id: string | number;
  name: string;
  frame: number;
  url: string;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseItem;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: any, modalData: modalData) => void;
}

class ShopConsumableCard extends Component<ShopCardProps> {
  render() {
    const getRarityValue = (effort) => {
      if(effort < 10) {
        return {val: "Common", clr: "cyan"};
      } else if(effort < 25) {
        return {val: "Rare", clr: "tomato"};
      } else if(effort < 50) {
        return {val: "Epic", clr: "red"};
      } else {
        return {val: "Legendary", clr: "orange"};
      }
    }

    const { data } = this.props;

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: consumablesSpritesheet,
      frame: data.frame,
      price: data.price
    }

    const titleStyle = {
      borderRadius: '4px',
    }
    
    const coordinates = mapFrameToCoordinates(data.frame);

    const getEffectValue = (effect: Effect) => {
      if(effect.value === -1) return '∞';
      return `+${effect.value}`;
    }

    return (
      <div className="shop-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
        <div className="shop-card-title" style={titleStyle}>
          <span>{data.name}</span>
          <div className="consumable-card-info-box">
            <img src={itemCountIcon} alt="count icon" />
            <span>{this.props.getItemAmount(data.id, InventoryType.CONSUMABLES)}</span>
          </div>
        </div>
        <div className="consumable-card-content">
          <div className="shop-portrait" style={{ 
              backgroundImage: `url(${consumablesSpritesheet})`,
              backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
          }} />
        </div>
        <p data-tooltip-id={`consumable-desc-tooltip-${data.id}`} className="consumable-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => (
            <div key={index} className="consumable-card-effect">
              <img 
                src={StatIcons[effect.stat]} 
                style={effect.stat === 1 ? {transform: 'scaleX(0.8)'} : {}} 
                alt="" 
              />
              <span>{getEffectValue(effect)}</span>
            </div>
          ))}
          <div className="consumable-card-effect">
            <img src={cdIcon} style={{transform: 'scaleX(0.8)'}} alt="cooldown" />
            <span>{getSpeedClass(data.speedClass)}</span>
          </div>
          <div className="consumable-card-effect">
            <img src={targetIcon} alt="target" />
            <span>{Target[data.target]}</span>
          </div>
        </div>
        <div style={{lineHeight: '0.5'}}>
          <span style={{color: `${getRarityValue(data.effort).clr}`, fontSize: '11px', fontFamily: 'Kim'}}>
            {getRarityValue(data.effort).val}
          </span>
        </div>
        <div className="shop-card-price">
          <img src={goldIcon} alt="gold" />
          {data.price}
        </div>

        <ReactTooltip
          id={`consumable-desc-tooltip-${data.id}`}
          place="top-start"
          variant="light"
          content={data.description}
          style={{maxWidth: '120px'}}
        />
      </div>
    );
  }
}

export default ShopConsumableCard;