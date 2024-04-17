// ShopEquipmentCard.tsx
import './ShopEquipmentCard.style.css';
import { h, Component } from 'preact';
import { Class, InventoryType, Stat, equipmentFields } from "@legion/shared/enums";
import { equipments } from '@legion/shared/Equipments';
import { INFO_BG_COLOR } from '../itemDialog/ItemDialogType';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { StatIcons } from '../shopConsumableCard/ShopConsumableCard';
import { SpellTitleBG } from '../shopSpellCard/ShopSpellCard';

enum ClassIcon {
  '/shop/warrior_icon.png',
  '/shop/mage_icon.png',
}

interface modalData {
  id: string | number;
  name: string;
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
    const { data } = this.props;

    const classStyle = (classes: Class) => {
      return {
        backgroundImage: `url(/shop/${classes === Class.BLACK_MAGE ? 'purple' : 'white'}_box_bg.png)`,
      }
    }

    const statColor = (statIndex: number) => {
      return {
        backgroundColor: INFO_BG_COLOR[Stat[statIndex]]
      }
    }

    const statValue = (value: number) => {
      return value > 0 ? `+${value}` : value;
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `/equipment/${data.frame}`,
      price: data.price
    }

    const titleStyle = {
      backgroundImage: SpellTitleBG[data.rarity]
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
          <img src={`/equipment/${data.frame}`} alt="equipment-image" />
          <div className="shop-card-class-container">
            {data.classes.map((classes, index) => <div key={index} className="shop-card-class" style={classStyle(classes)}>
              <img src={classes === Class.WARRIOR ? ClassIcon[0] : ClassIcon[1]} style={classes === Class.WARRIOR ? 'transform: scaleX(1.5)' : ''} alt="mp" />
            </div>)}
          </div>
          <div className="equipment-card-class-badge">
            <img src={`/inventory/${equipmentFields[data.slot]}_icon.png`} alt="" />
          </div>
        </div>
        <p className="equipment-card-description">{data.description}</p>
        <div className="consumable-card-effect-container">
          {data.effects.map((effect, index) => <div key={index} className="consumable-card-effect">
            <img src={StatIcons[effect.stat]} alt="" />
            <span>{effect.value > 0 ? `+${effect.value}` : effect.value}</span>
          </div>)}
        </div>
        <div className="shop-card-price">
          <img src="/gold_icon.png" alt="gold" />
          {data.price}
        </div>
      </div>
    );
  }
}

export default ShopEquipmentCard;