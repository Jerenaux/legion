import { h, Component } from 'preact';
import ItemIcon from './ItemIcon';
import { InventoryType, Target } from '@legion/shared/enums';
import TabBar from './TabBar';
import { mapFrameToCoordinates } from '../utils';
import { PlayerProps } from '@legion/shared/interfaces';

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

  getBackgroundPosition (pendingSpellIdx: number) {
    const coordinates = mapFrameToCoordinates(this.props.player.spells[pendingSpellIdx]?.frame);
    coordinates.x = -coordinates.x + 0;
    coordinates.y = -coordinates.y + 1;
    const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;
    return backgroundPosition;
  }

  render(props: Props, state: State) {
    const { player } = props;

    if (!player) return;

    const portraitStyle = {
      backgroundImage: `url(/sprites/${player.portrait}.png)`,
    };
    const isCooldownActive = player.cooldown > 0;
    const isDead = player.hp <= 0;
    const canAct = !isCooldownActive && !isDead && !player.casting;
    const cooldownRatio = this.getCooldownRatio(player);
    const cooldownBarStyle = {
      width: `${cooldownRatio * 100}%`,
    }; 

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const itemsIndex = keyboardLayout.indexOf('Z');
    const goldenGradient = 'linear-gradient(to bottom right, #bf9b30, #1c1f25)'

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
                    <img src="/shop/hp_icon.png" alt="HP" />
                  </div>
                  <TabBar title="HP" value={player.hp} maxValue={player.maxHp} barClass="char_stats_hp" />
                </div>
                <div className="player_content_stats_bar">
                  <div className="player_content_stats_icon">
                    <img src="/inventory/mp_icon.png" alt="HP" />
                  </div>
                  <TabBar title="HP" value={player.mp} maxValue={player.maxMp} barClass="char_stats_mp" />
                </div>
                <div className="player_content_statuses">
                  {Object.keys(player.statuses).map((status: string) => player?.statuses[status] !== 0 && <div>
                    <img key={status} src={`/HUD/${status}_icon.png`} alt="" />
                    <span>{player.statuses[status]}</span>
                  </div>
                  )}
                </div>
              </div>
            </div>
            <div className="xp_bar_bg_container">
              <img src="/inventory/cd_icon.png" alt="" />
              <div className={`xp_bar_bg ${cooldownRatio === 1 ? 'cooldown_bar_flash' : ''}`}>
                <div className="cooldown_bar" style={cooldownBarStyle}></div>
              </div>
            </div>
          </div>

          <div className="flex width_half justify_between padding_8 padding_top_16 gap_24 padding_right_16">
            <div className="width_full">
              <p className="hud_actions_title">Items</p>
              <div className="grid player_hud_action_container gap_4 padding_y_4">
                {Array.from({ length: 6 }, (_, idx) => (
                  <div 
                    className="player_hud_skills flex items_center justify_center relative" 
                    key={idx}
                    style={{
                      background: player.pendingItem === idx ? goldenGradient : 'initial',
                    }}
                    onClick={(event: Event) => {
                      this.handleClick(event, itemsIndex + idx); 
                    }}
                  >
                    <ItemIcon
                      action={player.items[idx]}
                      index={idx}
                      canAct={canAct}
                      actionType={InventoryType.CONSUMABLES}
                      key={idx}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="width_full">
              <p className="hud_actions_title">Spells</p>
              <div className="grid player_hud_action_container gap_4 padding_y_4">
                {Array.from({ length: 6 }, (_, idx) => (
                  <div
                    className="player_hud_skills flex items_center justify_center relative"
                    key={idx}
                    style={{
                      background: player.pendingSpell === idx ? goldenGradient : 'initial',
                    }}
                    onClick={(event: Event) => {
                      this.handleClick(event, idx); 
                    }}
                  >
                    <ItemIcon
                      action={player.spells[idx]}
                      index={idx}
                      canAct={canAct && player.spells[idx]?.cost <= player.mp}
                      actionType={InventoryType.SKILLS}
                      key={idx}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {player.pendingSpell !== null && <div className="spell_target_container">
          <p className="spell_target_title">Select a target</p>
          <div className="spell_target">
            <div className="equip-dialog-image" style={{
              backgroundImage: `url(spells.png)`,
              backgroundPosition: this.getBackgroundPosition(player.pendingSpell),
            }} />
            <div className="dialog-spell-info-container">
              <div className="dialog-spell-info">
                <img src={'/inventory/mp_icon.png'} alt="mp" />
                <span>{player.spells[player.pendingSpell]?.cost}</span>
              </div>
              <div className="dialog-spell-info">
                <img src={'/inventory/cd_icon.png'} alt="cd" />
                <span>{player.spells[player.pendingSpell]?.cooldown}s</span>
              </div>
              <div className="dialog-spell-info">
                <img src={'/inventory/target_icon.png'} alt="target" />
                <span>{Target[player.spells[player.pendingSpell]?.target]}</span>
              </div>
            </div>
          </div>
        </div>}
      </div>
    );
  }
}

export default PlayerTab;