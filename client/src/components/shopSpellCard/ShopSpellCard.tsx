// Button.tsx
import './ShopSpellCard.style.css'
import { h, Component } from 'preact';
import { Class, InventoryType, Target } from "@legion/shared/enums";
import { BaseSpell } from '@legion/shared/BaseSpell';
import { mapFrameToCoordinates } from '../utils';
import { Tooltip as ReactTooltip } from "react-tooltip";

export enum SpellTitleBG {
  'url(/shop/item_title_bg_blue.png)',
  'url(/shop/item_title_bg_green.png)',
  'url(/shop/item_title_bg_purple.png)'
}

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
  data: BaseSpell;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: any, modalData: modalData) => void;
}

class ShopSpellCard extends Component<ShopCardProps> {
  render() {
    const { data } = this.props;

    const classStyle = (classes: Class) => {
      return {
        backgroundImage: `url(/shop/${classes === Class.BLACK_MAGE ? 'purple' : 'white'}_box_bg.png)`
      }
    }

    const titleStyle = {
      backgroundImage: SpellTitleBG[data.rarity]
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `/spells/${data.frame}`,
      price: data.price
    }

    const coordinates = mapFrameToCoordinates(data.frame);

    return (
      <div className="spell-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
        <div className="spell-card-title" style={titleStyle}>
          <span>{data.name}</span>
          <div className="spell-card-info-container">
            <div className="spell-card-info-box">
              <span className="spell-card-info-lv">LV</span>
              <span>{data.minLevel}</span>
            </div>
            <div className="spell-card-info-box">
              <img src="/shop/item_count_icon.png" alt="count icon" />
              <span>{this.props.getItemAmount(data.id, InventoryType.SKILLS)}</span>
            </div>
          </div>
        </div>
        <div className="spell-card-content">
          <div className="shop-portrait" style={{ 
                backgroundImage: `url(spells.png)`,
                backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
            }} />
          <div className="shop-card-class-container">
            {data.classes.map((classes, index) => <div key={index} className="spell-card-class" style={classStyle(classes)}>
              <img src={classes === Class.WARRIOR ? ClassIcon[0] : ClassIcon[1]} alt="mp" />
            </div>)}
          </div>
        </div>
        <p data-tooltip-id={`spell-desc-tooltip-${data.id}`} className="spell-card-description">{data.description}</p>
        <div className="spell-card-effect-container">
          <div className="spell-card-effect">
            <img src="/inventory/mp_icon.png" alt="cost" />
            <span>+ {data.cost}</span>
          </div>
          <div className="spell-card-effect">
            <img src="/inventory/cd_icon.png" alt="cost" />
            <span>{data.cooldown}</span>
          </div>
          <div className="spell-card-effect">
            <img src="/inventory/target_icon.png" alt="cost" />
            <span>{Target[data.target]}</span>
          </div>
        </div>
        <div className="spell-card-price">
          <img src="/gold_icon.png" alt="gold" />
          {data.price}
        </div>

        <ReactTooltip
          id={`spell-desc-tooltip-${data.id}`}
          place="top-start"
          variant="light"
          content={data.description}
          style={{maxWidth: '120px'}}
        />
      </div>
    );
  }
}

export default ShopSpellCard;