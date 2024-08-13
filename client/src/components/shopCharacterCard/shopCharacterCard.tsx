// ShopCharacterCard.tsx
import './shopCharacterCard.style.css';
import { h, Component } from 'preact';
import { Class, Stat } from "@legion/shared/enums";
import { equipments } from '@legion/shared/Equipments';
import { INFO_BG_COLOR, INFO_TYPE } from '../itemDialog/ItemDialogType';
import { classEnumToString } from '../utils';

import { spells } from '@legion/shared/Spells';
import { mapFrameToCoordinates } from '../utils';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { Target } from '@legion/shared/enums';

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

interface ShopCharacterCardState {
  curItem: BaseSpell;
  shopCharacterCardDialogShow: boolean;
}

class ShopCharacterCard extends Component<ShopCharacteCardProps, ShopCharacterCardState> {
  constructor(props: ShopCharacteCardProps) {
    super(props);
    this.state = {
      curItem: null,
      shopCharacterCardDialogShow: false,
    }
  }

  render() {
    const getRarityValue = (effort) => {
      if (effort < 10) {
        return { val: "Common", clr: "cyan" };
      } else if (effort < 25) {
        return { val: "Rare", clr: "tomato" };
      } else if (effort < 50) {
        return { val: "Epic", clr: "red" };
      } else {
        return { val: "Legendary", clr: "orange" };
      }
    }

    const { data } = this.props;

    // console.log('characterData ', data);

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

    // console.log("dataSkillSlots => ", data.skill_slots);
    // console.log("characterData => ", data);

    // console.log("spellData => ", spells);

    const getSpell = (spellId) => {
      // console.log("individualSpell => ", spells.find(item => item.id == spellId)); 
      return spells.find(item => item.id == spellId);
    }

    return (
      <div className="shop-character-card-container" key={this.props.key} onClick={(e) => {
        this.props.handleOpenModal(e, modalData); 
        this.setState({shopCharacterCardDialogShow: false});  
      }}>
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
          <div onClick={(event) => event.stopPropagation()} className="shop-character-card-class-container">
            {data.skills.map((item, i) => (
              <div
                key={i}
                style={{ backgroundImage: 'linear-gradient(to right, white, #1c1f25)' }}
                className="shop-character-card-slot"
                onClick={() => {
                  this.setState({ shopCharacterCardDialogShow: true });
                  this.setState({ curItem: getSpell(item) });
                }}
              >
                <div
                  style={{
                    backgroundImage: `url(/spells.png)`,
                    backgroundPosition: `-${mapFrameToCoordinates(getSpell(item).frame).x}px -${mapFrameToCoordinates(getSpell(item).frame).y}px`,
                    cursor: 'pointer',
                  }}
                />
              </div>
            ))}

            {Array.from({ length: data.skill_slots }, (_, i) => {
              if (i >= data.skills.length) {
                return (
                  <div key={i} className="shop-character-card-slot"></div>
                )
              }
            })}
          </div>

          <div className="shop-character-card-dialog-position">
            <div
              onClick={(event) => event.stopPropagation()}
              style={this.state.shopCharacterCardDialogShow ? { display: "flex" } : { display: "none" }}
              className="shop-character-card-dialog-container"
            >
              <div className="shop-character-card-dialog-wrapper">
                <div className="shop-character-card-dialog-container-image" style={{
                  backgroundImage: `url(spells.png)`,
                  backgroundPosition: `-${mapFrameToCoordinates(this.state.curItem?.frame).x}px -${mapFrameToCoordinates(this.state.curItem?.frame).y}px`,
                }} />
              </div>
              <p className="shop-character-card-dialog-name">{this.state.curItem?.name}</p>
              <p className="shop-character-card-dialog-desc">{this.state.curItem?.description}</p>
              <div className="shop-character-card-dialog-info-container">
                <div className="shop-character-card-dialog-info">
                  <img src={'/inventory/mp_icon.png'} alt="mp" />
                  <span>{this.state.curItem?.cost}</span>
                </div>
                <div className="shop-character-card-dialog-info">
                  <img src={'/inventory/cd_icon.png'} alt="cd" />
                  <span>{this.state.curItem?.cooldown}s</span>
                </div>
                <div className="shop-character-card-dialog-info">
                  <img src={'/inventory/target_icon.png'} alt="target" />
                  <span>{Target[this.state.curItem?.target]}</span>
                </div>
              </div>
              <div className="dialog-button-container">
                <button className="dialog-decline" onClick={() => this.setState({ shopCharacterCardDialogShow: false })}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
              </div>
            </div>
          </div>

        </div>

        <div className="shop-character-card-effect-container">
          {statsArray.map((stat, index) => <div key={index} className="shop-character-card-effect">
            <div className="shop-character-card-effect-stat" style={statColor(stat.key)}><span>{INFO_TYPE[stat.key]}</span></div>
            <div className="shop-character-card-effect-value"><span>{stat.value}</span></div>
          </div>)}
        </div>
        <div style={{ lineHeight: '0.5' }}>
          <span style={{ color: `${getRarityValue(data.effort).clr}`, fontSize: '11px' }}>
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