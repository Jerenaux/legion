// ShopSpellCard.tsx
import './ShopSpellCard.style.css'
import { h, Component, createRef } from 'preact';
import { Class, InventoryType, RarityColor, Target } from "@legion/shared/enums";
import { BaseSpell } from '@legion/shared/BaseSpell';
import { getSpeedClass, mapFrameToCoordinates } from '../utils';
import { Tooltip as ReactTooltip } from "react-tooltip";

// Import image assets
import spellsSpritesheet from '@assets/spells.png';
import warriorIcon from '@assets/shop/warrior_icon.png';
import mageIcon from '@assets/shop/mage_icon.png';
import itemCountIcon from '@assets/shop/item_count_icon.png';
import whiteBoxBg from '@assets/shop/white_box_bg.png';
import purpleBoxBg from '@assets/shop/purple_box_bg.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';
import goldIcon from '@assets/gold_icon.png';

interface modalData {
  id: string | number;
  name: string;
  url: string;
  frame: number;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseSpell;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: any, modalData: modalData) => void;
  isHighlighted?: boolean;
}

class ShopSpellCard extends Component<ShopCardProps> {
  private cardRef = createRef();

  componentDidMount() {
    if (this.props.isHighlighted && this.cardRef.current) {
      this.cardRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    }
  }

  componentDidUpdate(prevProps: ShopCardProps) {
    if (!prevProps.isHighlighted && this.props.isHighlighted && this.cardRef.current) {
      this.cardRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    }
  }

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
        backgroundImage: `url(${classes === Class.BLACK_MAGE ? purpleBoxBg : whiteBoxBg})`
      }
    }

    const titleStyle = {
      borderRadius: '4px',
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      frame: data.frame,
      url: spellsSpritesheet,
      price: data.price
    }

    const coordinates = mapFrameToCoordinates(data.frame);

    return (
      <div 
        ref={this.cardRef}
        className={`spell-card-container ${this.props.isHighlighted ? 'feature-highlight' : ''}`} 
        key={this.props.key} 
        onClick={(e) => this.props.handleOpenModal(e, modalData)}
      >
        <div className="spell-card-title" style={titleStyle}>
          <span>{data.name}</span>
          <div className="spell-card-info-container">
            {/* <div className="spell-card-info-box">
              <span className="spell-card-info-lv">Lvl</span>
              <span>{data.minLevel}</span>
            </div> */}
            <div className="spell-card-info-box">
              <img src={itemCountIcon} alt="count icon" />
              <span>{this.props.getItemAmount(data.id, InventoryType.SPELLS)}</span>
            </div>
          </div>
        </div>
        <div className="spell-card-content">
          <div className="shop-portrait" style={{ 
                backgroundImage: `url(${spellsSpritesheet})`,
                backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
            }} />
          <div className="shop-card-class-container">
            {data.classes.map((classes, index) => (
              <div key={index} className="spell-card-class" style={classStyle(classes)}>
                <img src={classes === Class.WARRIOR ? warriorIcon : mageIcon} alt="class icon" />
              </div>
            ))}
          </div>
        </div>
        <p data-tooltip-id={`spell-desc-tooltip-${data.id}`} className="spell-card-description">{data.description}</p>
        <div className="spell-card-effect-container">
          <div className="spell-card-effect">
            <img src={mpIcon} alt="cost" />
            <span>{data.cost}</span>
          </div>
          <div className="spell-card-effect">
            <img src={cdIcon} alt="cooldown" />
            <span>{getSpeedClass(data.speedClass)}</span>
          </div>
          <div className="spell-card-effect">
            <img src={targetIcon} alt="target" />
            <span>{Target[data.target]}</span>
          </div>
        </div>
        <div style={{lineHeight: '0.5'}}>
          <span style={{color: `${getRarityValue(data.effort).clr}`, fontSize: '11px', fontFamily: 'Kim'}}>
            {getRarityValue(data.effort).val}
          </span>
        </div>
        <div className="spell-card-price">
          <img src={goldIcon} alt="gold" />
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