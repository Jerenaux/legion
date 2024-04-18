// ShopConsumableCard.tsx
import './ShopConsumableCard.style.css';
import { h, Component } from 'preact';
import { InventoryType, Target } from "@legion/shared/enums";
import { BaseItem } from '@legion/shared/BaseItem';
import { SpellTitleBG } from '../shopSpellCard/ShopSpellCard';

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
    const { data } = this.props;

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `/consumables/${data.frame}`,
      price: data.price
    }

    const titleStyle = {
      backgroundImage: SpellTitleBG[data.rarity]
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
          <img src={`/consumables/${data.frame}`} alt="spell-image" />
        </div>
        <p className="consumable-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => <div key={index} className="consumable-card-effect">
            <img src={StatIcons[effect.stat]} style={effect.stat === 1 ? 'transform: scaleX(0.8)' : ''} alt="" />
            <span>{effect.value > 0 ? `+${effect.value}` : effect.value}</span>
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
        <div className="shop-card-price">
          <img src="/gold_icon.png" alt="gold" />
          {data.price}
        </div>
      </div>
    );
  }
}

export default ShopConsumableCard;