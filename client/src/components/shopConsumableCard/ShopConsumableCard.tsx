// ShopConsumableCard.tsx
import './ShopConsumableCard.style.css';
import { h, Component } from 'preact';
import { InventoryType, Target } from "@legion/shared/enums";
import { items } from '@legion/shared/Items';
import { ShopCardProps } from '../shopSpellCard/ShopSpellCard';

enum StatIcons {
  '/inventory/cd_icon.png',
  '/inventory/mp_icon.png',
  '/inventory/target_icon.png',
  '/1.png',
  '/2.png',
  '/3.png',
  '/4.png',
}

interface modalData {
  id: string | number;
  name: string;
  url: string;
  price: number;
}

class ShopConsumableCard extends Component<ShopCardProps> {
  render() {
    const data = items[this.props.index];

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `/consumables/${data.frame}`,
      price: data.price
    }

    return (
      <div className="shop-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
        <div className="shop-card-title">
          <span>{data.name}</span>
          <div className="consumable-card-info-box">
            <img src="/shop/item_count_icon.png" alt="count icon" />
            <span>{this.props.getItemAmount(this.props.index, InventoryType.CONSUMABLES)}</span>
          </div>
        </div>
        <div className="consumable-card-content">
          <img src={`/consumables/${data.frame}`} alt="spell-image" />
        </div>
        <p className="consumable-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => <div key={index} className="consumable-card-effect">
            <img src={StatIcons[effect.stat]} alt="" />
            <span>{effect.value}</span>
          </div>)}
          <div className="consumable-card-effect">
            <img src="/inventory/cd_icon.png" alt="cost" />
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