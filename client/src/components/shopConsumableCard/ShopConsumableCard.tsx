// ShopConsumableCard.tsx
import './ShopConsumableCard.style.css';
import { h, Component } from 'preact';
import { InventoryType, RarityColor, Target } from "@legion/shared/enums";
import { BaseItem } from '@legion/shared/BaseItem';
import { SpellTitleBG } from '../shopSpellCard/ShopSpellCard';
import { mapFrameToCoordinates } from '../utils';
import { Tooltip as ReactTooltip } from "react-tooltip";
import { Effect } from '@legion/shared/interfaces';

export enum StatIcons {
  '/shop/hp_icon.png',
  '/inventory/mp_icon.png',
  '/shop/attack_icon.png',
  '/shop/def_icon.png',
  '/shop/satk_icon.png',
  '/shop/sdef_icon.png',
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
  data: BaseItem;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: any, modalData: modalData) => void;
}

class ShopConsumableCard extends Component<ShopCardProps> {
  render() {
    const getRarityValue = (effort) => {
      if(effort < 10) {
        return {val: "common", clr: "cyan"};
      } else if(effort < 25) {
        return {val: "rare", clr: "tomato"};
      } else if(effort < 50) {
        return {val: "epic", clr: "red"};
      } else {
        return {val: "legendary", clr: "orange"};
      }
    }

    const { data } = this.props;

    console.log('consumable -> data -> ', data);

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `consumables.png`,
      frame: data.frame,
      price: data.price
    }

    const titleStyle = {
      border: `1px solid ${RarityColor[data.rarity]}`,
      borderRadius: '4px',
    }
    
    const coordinates = mapFrameToCoordinates(data.frame);

    const getEffectValue = (effect: Effect) => {
      return effect.value > 0 && effect.stat !== 1 ? `+${effect.value}` : effect.value;
    }

    return (
      <div className="shop-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
        <div className="shop-card-title" style={titleStyle}>
          <span>{data.name}</span>
          <div className="consumable-card-info-box">
            <img src="/shop/item_count_icon.png" alt="count icon" />
            <span>{this.props.getItemAmount(data.id, InventoryType.CONSUMABLES)}</span>
          </div>
        </div>
        <div className="consumable-card-content">
          <div className="shop-portrait" style={{ 
              backgroundImage: `url(consumables.png)`,
              backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
          }} />
        </div>
        <p data-tooltip-id={`consumable-desc-tooltip-${data.id}`} className="consumable-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => <div key={index} className="consumable-card-effect">
            <img src={StatIcons[effect.stat]} style={effect.stat === 1 ? 'transform: scaleX(0.8)' : ''} alt="" />
            <span>{getEffectValue(effect)}</span>
          </div>)}
          <div className="consumable-card-effect">
            <img src="/inventory/cd_icon.png" style={{transform: 'scaleX(0.8)'}} alt="cost" />
            <span>{data.cooldown}</span>
          </div>
          <div className="consumable-card-effect">
            <img src="/inventory/target_icon.png" alt="cost" />
            <span>{Target[data.target]}</span>
          </div>
        </div>
        <div style={{lineHeight: '0.5'}}>
          <span style={{color: `${getRarityValue(data.effort).clr}`, fontSize: '11px'}}>
            {getRarityValue(data.effort).val}
          </span>
        </div>
        <div className="shop-card-price">
          <img src="/gold_icon.png" alt="gold" />
          +{data.price}
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