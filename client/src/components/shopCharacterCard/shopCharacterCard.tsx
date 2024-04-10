// ShopCharacterCard.tsx
import './shopCharacterCard.style.css';
import { h, Component } from 'preact';
import { Class, Stat } from "@legion/shared/enums";
import { equipments } from '@legion/shared/Equipments';
import { INFO_BG_COLOR, INFO_TYPE } from '../itemDialog/ItemDialogType';
import { classEnumToString } from '../utils';

interface ShopCharacteCardProps {
  key: number;
  data: any;
}

class ShopCharacterCard extends Component<ShopCharacteCardProps> {
  render() {
    const {data} = this.props;
    const statsArray = Object.entries(data.stats).map(([key, value]) => ({ key, value: value as number }));

    const portraitStyle = {
      backgroundImage: `url(/sprites/${data.portrait}.png)`,
    };

    const statColor = (stat: string) => {
      return {
        backgroundColor: INFO_BG_COLOR[INFO_TYPE[stat]]
      }
    }

    return (
      <div className="shop-character-card-container" key={this.props.key}>
        <div className="shop-character-card-title">
          <div className="shop-character-card-title-name">
            <span>{data.name}</span>
            <span className="character-class">{classEnumToString(data.class)}</span>
          </div>
          <div className="shop-character-card-info-container">
            <div className="shop-character-card-info-box">
              <span className="shop-character-card-info-lv">LV</span>
              <span>{data.level}</span>
            </div>
          </div>
        </div>

        <div className="shop-character-card-content">
          <div className="character-card-portrait" style={portraitStyle}></div>
          <div className="shop-character-card-class-container">
            { Array.from({ length: data.skill_slots }, (_, i) => (
              <div key={i} className="shop-character-card-slot"></div>
            ))}
          </div>
        </div>

        <div className="shop-character-card-effect-container">
          {statsArray.map((stat, index) => <div key={index} className="shop-character-card-effect">
            <div className="shop-character-card-effect-stat" style={statColor(stat.key)}><span>{INFO_TYPE[stat.key]}</span></div>
            <div className="shop-character-card-effect-value"><span>{stat.value}</span></div>
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

export default ShopCharacterCard;