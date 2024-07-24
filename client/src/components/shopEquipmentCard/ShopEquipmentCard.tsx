// ShopEquipmentCard.tsx
import './ShopEquipmentCard.style.css';
import { h, Component } from 'preact';
import { Class, InventoryType, RarityColor, equipmentFields } from "@legion/shared/enums";
import { mapFrameToCoordinates } from '../utils';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { StatIcons } from '../shopConsumableCard/ShopConsumableCard';
import { SpellTitleBG } from '../shopSpellCard/ShopSpellCard';
import { Tooltip as ReactTooltip } from "react-tooltip";
import { Effect } from '@legion/shared/interfaces';

enum ClassIcon {
  '/shop/warrior_icon.png',
  '/shop/mage_icon.png',
}

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

    console.log('equipment -> data -> ', data);

    const classStyle = (classes: Class) => {
      return {
        backgroundImage: `url(/shop/${classes === Class.BLACK_MAGE ? 'purple' : 'white'}_box_bg.png)`,
      }
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      frame: data.frame,
      url: `equipment.png`,
      price: data.price
    }

    const titleStyle = {
      // border: `1px solid ${RarityColor[data.rarity]}`,
      borderRadius: '4px',
    }

    const coordinates = mapFrameToCoordinates(data.frame);

    const getEffectValue = (effect: Effect) => {
      return effect.value > 0 && effect.stat !== 1 ? `+${effect.value}` : `+${effect.value}`;
    }

    return (
      <div className="shop-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
        <div className="shop-card-title" style={titleStyle}>
          <span className="shop-card-title-name">{data.name}</span>
          <div className="equipment-card-info-container">
            <div className="equipment-card-info-box">
              <span className="equipment-card-info-lv">LV</span>
              <span>{data.minLevel}</span>
            </div>
            <div className="equipment-card-info-box">
              <img src="/shop/item_count_icon.png" alt="count icon" />
              <span>{this.props.getItemAmount(data.id, InventoryType.EQUIPMENTS)}</span>
            </div>
          </div>
        </div>
        <div className="equipment-card-content">
          <div className="shop-portrait" style={{ 
                backgroundImage: `url(equipment.png)`,
                backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
            }} />
          <div className="shop-card-class-container">
            {data.classes.map((classes, index) => <div key={index} className="shop-card-class" style={classStyle(classes)}>
              <img src={classes === Class.WARRIOR ? ClassIcon[0] : ClassIcon[1]} style={classes === Class.WARRIOR ? 'transform: scaleX(1.5)' : ''} alt="mp" />
            </div>)}
          </div>
          <div className="equipment-card-class-badge">
            <img src={`/inventory/${equipmentFields[data.slot]}_icon.png`} alt="" />
          </div>
        </div>
        <p data-tooltip-id={`equipment-desc-tooltip-${data.id}`} className="equipment-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => <div key={index} className="consumable-card-effect">
            <img src={StatIcons[effect.stat]} alt="" />
            <span>{getEffectValue(effect)}</span>
          </div>)}
        </div>
        <div style={{lineHeight: '0.5'}}>
          <span style={{color: `${getRarityValue(data.effort).clr}`, fontSize: '11px'}}>
            {getRarityValue(data.effort).val}
          </span>
        </div>
        <div className="shop-card-price">
          <img src="/gold_icon.png" alt="gold" />
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