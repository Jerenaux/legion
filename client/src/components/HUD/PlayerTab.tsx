import { h, Component, Fragment } from 'preact';
import ItemIcon from './ItemIcon';
import { InventoryType, StatusEffect, Target } from '@legion/shared/enums';
import TabBar from './TabBar';
import { mapFrameToCoordinates, getSpritePath } from '../utils';
import { PlayerProps } from '@legion/shared/interfaces';
import { BaseSpell } from '@legion/shared/BaseSpell';

import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

import hpIcon from '@assets/shop/hp_icon.png';
import mpIcon from '@assets/inventory/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';

import freezeIcon from '@assets/HUD/freeze_icon.png';
import muteIcon from '@assets/HUD/mute_icon.png';
import paralyzeIcon from '@assets/HUD/paralyze_icon.png';
import blindIcon from '@assets/HUD/blind_icon.png';
import sleepIcon from '@assets/HUD/sleep_icon.png';
import poisonIcon from '@assets/HUD/poison_icon.png';
import burnIcon from '@assets/HUD/burn_icon.png';

interface Props {
  player: PlayerProps;
  eventEmitter: any;
}

interface State {
  player: PlayerProps;
}

class PlayerTab extends Component<Props, State> {
  timerID: NodeJS.Timeout;
  events: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      player: this.props.player,
    };
    this.events = this.props.eventEmitter;
  }

  statusIcons = {
    'Freeze': freezeIcon,
    'Mute': muteIcon,
    'Paralyze': paralyzeIcon,
    'Blind': blindIcon,
    'Sleep': sleepIcon,
    'Poison': poisonIcon,
    'Burn': burnIcon,
  }

  componentDidMount() {
    // this.timerID = setInterval(() => this.tick(), 1000); 
  }

  componentWillUnmount() {
    clearInterval(this.timerID); 
  }

  actionClick(index: number) {
    this.events.emit('itemClick', index);
  } 

  handleClick = (event: Event, index: number) => {
    event.stopPropagation(); 
    this.actionClick(index);
  } 

  getCooldownRatio(player: PlayerProps): number {
    return (player.maxCooldown - player.cooldown) / player.maxCooldown;
  }

  getBackgroundPosition(frame: number) {
    const coordinates = mapFrameToCoordinates(frame);
    coordinates.x = -coordinates.x + 0;
    coordinates.y = -coordinates.y + 1;
    return `${coordinates.x}px ${coordinates.y}px`;
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
    const spritesheet = type === 'spell' ? spellsSpritesheet : consumablesSpritesheet;

    return (
      <div className="spell_target_container">
        <p className="spell_target_title">Select a target</p>
        <div className="spell_target">
          <div className="equip-dialog-image" style={{
            backgroundImage: `url(${spritesheet})`,
            backgroundPosition: this.getBackgroundPosition(action.frame),
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
              <span>{action.getCooldown()}s</span>
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
    const isCooldownActive = player.cooldown > 0;
    const isDead = player.hp <= 0;
    const canAct = !isCooldownActive && !isDead && !player.casting && !player.isParalyzed;
    const isMuted = player.statuses[StatusEffect.MUTE] != 0;
    const cooldownRatio = this.getCooldownRatio(player);
    const cooldownBarStyle = {
      width: `${cooldownRatio * 100}%`,
    }; 

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const itemsIndex = keyboardLayout.indexOf('Z');

    return (
      <div className="flex flex_col items_center">
        <div className="player_tab_container">
          <div className="player_content_container">
            <div className="player_content">
              <div className="player_content_portrait">
                <div className="character_portrait" style={portraitStyle}></div>
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
                  {Object.keys(player.statuses).map((status: string) => player?.statuses[status] !== 0 && (
                    <div key={status}>
                      <img src={this.statusIcons[status]} alt="" />
                      <span>{player.statuses[status] == -1 ? '∞' : player.statuses[status]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="xp_bar_bg_container">
              <img src={cdIcon} alt="" />
              <div className={`xp_bar_bg ${cooldownRatio === 1 ? 'cooldown_bar_flash' : ''}`}>
                <div className="cooldown_bar" style={cooldownBarStyle}></div>
              </div>
            </div>
          </div>

          <div className="flex width_half justify_between padding_8 padding_top_16 gap_24 padding_right_16">
            {this.renderActionContainer("Items", player.items, canAct, isMuted, itemsIndex, InventoryType.CONSUMABLES)}
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