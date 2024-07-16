// ShopCharacterCard.tsx
import './shopCharacterCard.style.css';
import { h, Component } from 'preact';
import { Class, Stat } from "@legion/shared/enums";
import { equipments } from '@legion/shared/Equipments';
import { INFO_BG_COLOR, INFO_TYPE } from '../itemDialog/ItemDialogType';
import { classEnumToString } from '../utils';

interface modalData {
  id: string | number;
  name: string;
  url: string;
  price: number;
}

interface ShopCharacteCardProps {
  key: number;
  data: any;
  handleOpenModal: (e: any, modalData: modalData) => void;
}

class ShopCharacterCard extends Component<ShopCharacteCardProps> {
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

    const {data} = this.props;

    console.log('character -> data -> ', data);

    const statsArray = Object.entries(data.stats).map(([key, value]) => ({ key, value: value as number }));

    const portraitStyle = {
      backgroundImage: `url(/sprites/${data.portrait}.png)`,
    };

    const statColor = (stat: string) => {
      return {
        backgroundColor: INFO_BG_COLOR[INFO_TYPE[stat]]
      }
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      url: `/sprites/${data.portrait}.png`,
      price: data.price
    }

    return (
      <div className="shop-character-card-container" key={this.props.key} onClick={(e) => this.props.handleOpenModal(e, modalData)}>
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
        <div style={{lineHeight: '0.5'}}>
          <span style={{color: `${getRarityValue(data.effort).clr}`, fontSize: '11px'}}>
            {getRarityValue(data.effort).val}
          </span>
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