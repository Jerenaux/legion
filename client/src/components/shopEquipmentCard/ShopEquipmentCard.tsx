// ShopEquipmentCard.tsx
import './ShopEquipmentCard.style.css';
import { h, Component } from 'preact';
import { Class, InventoryType, equipmentSlotFields } from "@legion/shared/enums";
import { mapFrameToCoordinates } from '../utils';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { StatIcons } from '../shopConsumableCard/ShopConsumableCard';
import { Tooltip as ReactTooltip } from "react-tooltip";
import { Effect } from '@legion/shared/interfaces';

// Import image assets
import equipmentSpritesheet from '@assets/equipment.png';
import warriorIcon from '@assets/shop/warrior_icon.png';
import mageIcon from '@assets/shop/mage_icon.png';
import purpleBoxBg from '@assets/shop/purple_box_bg.png';
import whiteBoxBg from '@assets/shop/white_box_bg.png';
import itemCountIcon from '@assets/shop/item_count_icon.png';
import goldIcon from '@assets/gold_icon.png';

interface modalData {
  id: string | number;
  name: string;
  frame: number;
  url: string;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseEquipment;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: any, modalData: modalData) => void;
  isHighlighted?: boolean;
}

class ShopEquipmentCard extends Component<ShopCardProps> {
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

    const classStyle = (classes: Class) => {
      return {
        backgroundImage: `url(${classes === Class.BLACK_MAGE ? purpleBoxBg : whiteBoxBg})`,
      }
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      frame: data.frame,
      url: equipmentSpritesheet,
      price: data.price
    }

    const titleStyle = {
      borderRadius: '4px',
    }

    const coordinates = mapFrameToCoordinates(data.frame);

    const getEffectValue = (effect: Effect) => {
      return effect.value > 0 && effect.stat !== 1 ? `+${effect.value}` : `+${effect.value}`;
    }

    return (
      <div 
        className={`shop-card-container ${this.props.isHighlighted ? 'feature-highlight' : ''}`} 
        key={this.props.key} 
        onClick={(e) => this.props.handleOpenModal(e, modalData)}
      >
        <div className="shop-card-title" style={titleStyle}>
          <span className="shop-card-title-name">{data.name}</span>
          <div className="equipment-card-info-container">
            {/* <div className="equipment-card-info-box">
              <span className="equipment-card-info-lv">Lvl</span>
              <span>{data.minLevel}</span>
            </div> */}
            <div className="equipment-card-info-box">
              <img src={itemCountIcon} alt="count icon" />
              <span>{this.props.getItemAmount(data.id, InventoryType.EQUIPMENTS)}</span>
            </div>
          </div>
        </div>
        <div className="equipment-card-content">
          <div className="shop-portrait" style={{ 
                backgroundImage: `url(${equipmentSpritesheet})`,
                backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
            }} />
          <div className="shop-card-class-container">
            {data.classes.map((classes, index) => (
              <div key={index} className="shop-card-class" style={classStyle(classes)}>
                <img 
                  src={classes === Class.WARRIOR ? warriorIcon : mageIcon} 
                  style={classes === Class.WARRIOR ? {transform: 'scaleX(1.5)'} : {}} 
                  alt={classes === Class.WARRIOR ? "warrior" : "mage"} 
                />
              </div>
            ))}
          </div>
          <div className="equipment-card-class-badge">
            <img src={require(`@assets/inventory/${equipmentSlotFields[data.slot]}_icon.png`)} alt="" />
          </div>
        </div>
        <p data-tooltip-id={`equipment-desc-tooltip-${data.id}`} className="equipment-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => (
            <div key={index} className="consumable-card-effect">
              <img src={StatIcons[effect.stat]} alt="" />
              <span>{getEffectValue(effect)}</span>
            </div>
          ))}
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
          id={`equipment-desc-tooltip-${data.id}`}
          place="top-start"
          variant="light"
          content={data.description}
          style={{maxWidth: '120px'}}
        />
      </div>
    );
  }
}

export default ShopEquipmentCard;