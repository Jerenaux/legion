// ShopCharacterCard.tsx
import './shopCharacterCard.style.css';
import { h, Component } from 'preact';
import { STATS_BG_COLOR, STATS_NAMES } from '../itemDialog/ItemDialogType';
import { classEnumToString, getSpritePath } from '../utils';
import { modalData } from '../shopContent/ShopContent';

import goldIcon from '@assets/gold_icon.png';
import { spells } from '@legion/shared/Spells';
import { mapFrameToCoordinates } from '../utils';
import { Target, RarityColor } from '@legion/shared/enums';
import { BaseSpell } from '@legion/shared/BaseSpell';

import spellsSpritesheet from '@assets/spells.png';

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
    const { data } = this.props;

    const statsArray = Object.entries(data.stats).map(([key, value]) => ({ key, value: value as number }));

    const portraitStyle = {
      backgroundImage: `url(${getSpritePath(data.portrait)})`,
    };

    const statColor = (stat: string) => {
      return {
        backgroundColor: STATS_BG_COLOR[STATS_NAMES[stat]]
      }
    }

    const modalData: modalData = {
      id: data.id,
      name: data.name,
      frame: -1,
      url: data.portrait,
      price: data.price,
      isCharacter: true
    }


    const getSpell = (spellId) => {
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
              <span className="shop-character-card-info-lv">Lvl&nbsp;</span>
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
                style={{ backgroundImage: `linear-gradient(to bottom right, ${RarityColor[getSpell(item)?.rarity]}, #1c1f25)` }}
                className="shop-character-card-slot"
                onClick={(event) => {
                  event.stopPropagation();
                  this.setState({ shopCharacterCardDialogShow: true });
                  this.setState({ curItem: getSpell(item) });
                }}
              >
                <div
                  style={{
                    backgroundImage: `url(${spellsSpritesheet})`,
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
          {statsArray.map((stat, index) => (
            <div key={index} className="shop-character-card-effect">
              <div className="shop-character-card-effect-stat" style={statColor(stat.key)}>
                <span>{STATS_NAMES[stat.key]}</span>
              </div>
              <div className="shop-character-card-effect-value">
                <span>{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="shop-card-price">
          <img src={goldIcon} alt="gold" />
          {data.price}
        </div>
      </div>
    );
  }
}

export default ShopCharacterCard;