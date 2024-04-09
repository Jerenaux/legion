// Button.tsx
import './ShopSpellCard.style.css'
import { h, Component } from 'preact';
import { Class, Target } from "@legion/shared/enums";
import { spells } from '@legion/shared/Spells';

interface SpellCardProps {
  key: number;
  index: number;
}

class ShopSpellCard extends Component<SpellCardProps> {
  render() {
    const data = spells[this.props.index];

    const classStyle = (classes: Class) => {
      return {
        backgroundImage: `url(/shop/${classes === Class.BLACK_MAGE ? 'purple' : 'white'}_box_bg.png)`
      }
    } 

    return (
      <div className="spell-card-container" key={this.props.key}>
        <div className="spell-card-title">
          <span>{data.name}</span>
          <div className="spell-card-info-container">
            <div className="spell-card-info-box">
              <span className="spell-card-info-lv">LV</span>
              <span>{data.minLevel}</span>
            </div>
            <div className="spell-card-info-box">
              <img src="/shop/item_count_icon.png" alt="count icon" />
              <span>3</span>
            </div>
          </div>
        </div>
        <div className="spell-card-content">
          <img src={`/spells/${data.frame}`} alt="spell-image" />
          {data.classes.map((classes, index) => <div key={index} className="spell-card-class" style={classStyle(classes)}>
            <img src="/shop/mage_icon.png" alt="mp" />
          </div>)}
        </div>
        <p className="spell-card-description">{data.description}</p>
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
      </div>
    );
  }
}

export default ShopSpellCard;