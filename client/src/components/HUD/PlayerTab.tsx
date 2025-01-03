import { h, Component, Fragment } from 'preact';
import ItemIcon from './ItemIcon';
import { InventoryType, StatusEffect, Target } from '@legion/shared/enums';
import TabBar from './TabBar';
import { mapFrameToCoordinates, getSpritePath, cropFrame, statusIcons } from '../utils';
import { PlayerProps } from '@legion/shared/interfaces';
import { BaseSpell } from '@legion/shared/BaseSpell';
import './PlayerTab.style.css';

import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';


interface Props {
  player: PlayerProps;
  eventEmitter: any;
  isTutorial?: boolean;
}

interface State {
  player: PlayerProps;
  croppedImages: {
    [key: string]: string;
  };
  itemsVisible: boolean;
}

class PlayerTab extends Component<Props, State> {
  timerID: NodeJS.Timeout;
  events: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      player: this.props.player,
      croppedImages: {},
      itemsVisible: !props.isTutorial,
    };
    this.events = this.props.eventEmitter;

    this.events.on('revealItems', () => {
      this.setState({ itemsVisible: true });
    });
  }

  componentDidMount() {
    this.cropAllSprites();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.player !== this.props.player) {
      this.cropAllSprites();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  cropAllSprites = async () => {
    const { player } = this.props;
    const newCroppedImages = { ...this.state.croppedImages };

    for (const item of player.items) {
      if (item && !newCroppedImages[`item-${item.id}`]) {
        newCroppedImages[`item-${item.id}`] = await this.cropSprite(consumablesSpritesheet, item.frame);
      }
    }

    for (const spell of player.spells) {
      if (spell && !newCroppedImages[`spell-${spell.id}`]) {
        newCroppedImages[`spell-${spell.id}`] = await this.cropSprite(spellsSpritesheet, spell.frame);
      }
    }

    this.setState({ croppedImages: newCroppedImages });
  }

  cropSprite = async (spritesheet: string, frame: number): Promise<string> => {
    const { x, y } = mapFrameToCoordinates(frame);
    try {
      return await cropFrame(spritesheet, x, y, 32, 32); // Assuming 32x32 sprite size
    } catch (error) {
      console.error('Error cropping spritesheet:', error);
      return '';
    }
  }

  actionClick(index: number) {
    this.events.emit('itemClick', index);
  } 

  handleClick = (event: Event, index: number) => {
    event.stopPropagation(); 
    this.actionClick(index);
  } 

  passTurn = (event: Event) => {
    event.stopPropagation();
    this.events.emit('passTurn');
  }

  renderActionContainer(title: string, actions: any[], canAct: boolean, isMuted: boolean, startIndex: number, inventoryType: InventoryType) {
    const { player } = this.props;
    const goldenGradient = 'linear-gradient(to bottom right, #bf9b30, #1c1f25)';

    return (
      <div className="width_full">
        <p className="hud_actions_title">{title}</p>
        <div className="grid player_hud_action_container gap_4 padding_y_4">
          {Array.from({ length: 6 }, (_, idx) => (
            <div 
              className={`player_hud_skills flex items_center justify_center relative ${player[inventoryType === InventoryType.CONSUMABLES ? 'pendingItem' : 'pendingSpell'] === idx ? 'blinking-gradient' : ''}`}
              key={idx}
              style={{
                background: player[inventoryType === InventoryType.CONSUMABLES ? 'pendingItem' : 'pendingSpell'] === idx ? goldenGradient : 'initial',
              }}
              onClick={(event: Event) => {
                this.handleClick(event, startIndex + idx); 
              }}
            >
              <ItemIcon
                action={actions[idx]}
                index={idx}
                canAct={canAct && (inventoryType === InventoryType.CONSUMABLES || (!isMuted && actions[idx]?.cost <= player.mp))}
                actionType={inventoryType}
                key={idx}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  renderTargetContainer(type: 'spell' | 'item', index: number) {
    const { player } = this.props;
    const action = type === 'spell' ? player.spells[index] : player.items[index];
    const croppedImage = this.state.croppedImages[`${type}-${action.id}`];

    return (
      <div className="spell_target_container">
        <p className="spell_target_title">Select a target</p>
        <div className="spell_target">
          <div className="equip-dialog-image" style={{
            backgroundImage: `url(${croppedImage})`,
            backgroundSize: 'cover',
          }} />
          <div className={`dialog-${type}-info-container`}>
            {type === 'spell' && 'cost' in action && (
              <div className="dialog-spell-info">
                <img src={mpIcon} alt="mp" />
                <span>{(action as BaseSpell).cost}</span>
              </div>
            )}
            <div className="dialog-spell-info">
              <img src={cdIcon} alt="cd" className={type === 'spell' ? 'cd-icon' : ''} />
              <span>{action.speedClass}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={targetIcon} alt="target" />
              <span>{Target[action.target]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }


  render(props: Props, state: State) {
    const { player } = props;

    if (!player) return null;

    const portraitStyle = {
      backgroundImage: `url(${getSpritePath(player.portrait)})`,
    };
    const isDead = player.hp <= 0;
    const canAct = !isDead && !player.casting && !player.isParalyzed;
    const isMuted = player.statuses[StatusEffect.MUTE] != 0;

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const itemsIndex = keyboardLayout.indexOf('Z');

    return (
      <div className="flex flex_col items_center">
        <div className="player_tab_container">
          <div className="player_content_container">
            <div className="player_content">
              <div className="player_content_left">
                <div className="player_content_portrait">
                  <div className="character_portrait" style={portraitStyle}></div>
                </div>
                <div className="pass-turn-button" onClick={this.passTurn}>
                  PASS TURN
                </div>
              </div>
              <div style={{ flex: '1', height: '100%' }}>
                <div className="player_content_name">
                  <div className="player_content_flag"><span>{player.number}</span></div>
                  <div className="player_content_char_name"><span>{player.name}</span></div>
                </div>
                <div className="player_content_stats_bar">
                  <div className="player_content_stats_icon">
                    <img src={hpIcon} alt="HP" />
                  </div>
                  <TabBar title="HP" value={player.hp} maxValue={player.maxHp} barClass="char_stats_hp" />
                </div>
                <div className="player_content_stats_bar">
                  <div className="player_content_stats_icon">
                    <img src={mpIcon} alt="HP" />
                  </div>
                  <TabBar title="HP" value={player.mp} maxValue={player.maxMp} barClass="char_stats_mp" />
                </div>
                <div className="player_content_statuses">
                  {Object.keys(player.statuses).map((status: string) => player?.statuses[status] !== 0 && <div>
                    <img key={status} src={statusIcons[status]} alt="" />
                    <span>{player.statuses[status] == -1 ? '∞' : player.statuses[status] }</span>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex width_half justify_between padding_8 padding_top_16 gap_24 padding_right_16">
            {this.state.itemsVisible && this.renderActionContainer("Items", player.items, canAct, isMuted, itemsIndex, InventoryType.CONSUMABLES)}
            {this.renderActionContainer("Spells", player.spells, canAct, isMuted, 0, InventoryType.SPELLS)}
          </div>
        </div>
        {player.pendingSpell !== null && this.renderTargetContainer('spell', player.pendingSpell)}
        {player.pendingItem !== null && this.renderTargetContainer('item', player.pendingItem)}
      </div>
    );
  }
}

export default PlayerTab;