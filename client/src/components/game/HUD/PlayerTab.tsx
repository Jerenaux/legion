import { h, Component } from 'preact';
import ActionItem from './Action';
import { InventoryType } from '@legion/shared/enums';
import TabBar from './TabBar';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { items } from '@legion/shared/Items';
import { spells } from '@legion/shared/Spells';

interface Player {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  cooldown: number;
  maxCooldown: number;
  casting: boolean;
  portrait: string;
  number: number;
  name: string;
  spells: number[];
  items: number[];
}

interface Props {
  player: Player;
  eventEmitter: any;
}

interface State {
  player: Player;
  clickedItem: number;
  clickedSpell: number;
}

class PlayerTab extends Component<Props, State> {
  timerID: NodeJS.Timeout;
  events: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      player: this.props.player,
      clickedItem: -1,
      clickedSpell: -1,
    };
    this.events = this.props.eventEmitter;
  }

  actionClick(type: string, letter: string, index: number) {
    this.events.emit('itemClick', letter);

    const stateField = type == 'item' ? 'clickedItem' : 'clickedSpell';
    this.setState({ [stateField]: index });

    setTimeout(() => {
      this.setState({ [stateField]: -1 });
    }, 1000);
  }

  getCooldownRatio(player: Player): number {
    return (player.maxCooldown - player.cooldown) / player.maxCooldown;
  }

  render(props: Props, state: State) {
    const { player } = props;

    const portraitStyle = {
      backgroundImage: `url(/sprites/${player.portrait}.png)`,
    };
    const isCooldownActive = player.cooldown > 0;
    const isDead = player.hp <= 0;
    const canAct = !isCooldownActive && !isDead && !player.casting;
    const headerText = `#${player.number} ${player.name}`;
    const cooldownRatio = this.getCooldownRatio(player);
    const cooldownBarStyle = {
      width: `${cooldownRatio * 100}%`,
    };

    return (
      <div className="player_tab_container">
        {/* <div className="character-header-arena">
          <div className="character-header-name">{headerText}</div>
          <div className="character-header-name-shadow">{headerText}</div>
        </div> */}
        {/* <div className="character-full-content">
          <div className="player-content">
            <div className="character-portrait" style={portraitStyle}></div>
            <div className="player-bars">
              <div>
                <TabBar title="HP" value={player.hp} maxValue={player.maxHp} barClass="hp-bar" />
                <TabBar title="MP" value={player.mp} maxValue={player.maxMp} barClass="mp-bar" />
                <div className="bar-title">Cooldown</div>
                <div className="xp-bar-bg">
                  <div className="hud-bar cooldown-bar" style={cooldownBarStyle}></div>
                </div>
              </div>
            </div>
            <div className="hud-actions">
              {player.spells && player.spells.length > 0 && (
                <div className="player-skills">
                  <div className="slots">
                    {player.spells.map((skill, i) => (
                      <ActionItem
                        action={spells[skill]}
                        index={i}
                        clickedIndex={this.state.clickedSpell}
                        canAct={canAct}
                        actionType={InventoryType.SKILLS}
                        onActionClick={this.actionClick.bind(this)}
                        key={i}
                      />
                    ))}
                  </div>
                </div>
              )}
  
              {player.items && player.items.length > 0 && (
                <div className="player-items">
                  <div className="slots">
                    {player.items.map((item, i) => (
                      <ActionItem
                        action={items[item]}
                        index={i}
                        clickedIndex={this.state.clickedItem}
                        canAct={canAct}
                        actionType={InventoryType.CONSUMABLES}
                        onActionClick={this.actionClick.bind(this)}
                        key={i}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div> */}
        <div className="player_content_container">
          <div className="player_content">
            <div className="player_content_portrait">
              <div className="character_portrait" style={portraitStyle}></div>
            </div>
            <div style={{ flex: '1', height: '100%' }}>
              <div className="player_content_name">
                <div className="player_content_flag"><span>4</span></div>
                <div className="player_content_char_name"><span>Char Name</span></div>
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
                <div>
                  <img src="/HUD/poison_icon.png" alt="" />
                  <span>25s</span>
                </div>
                <div>
                  <img src="/HUD/frozen_icon.png" alt="" />
                  <span>15s</span>
                </div>
                <div style={{ fontSize: '18px', lineHeight: '10px' }}>
                  <img src="/HUD/burning_icon.png" alt="" />
                  <span>&infin;</span>
                </div>
              </div>
            </div>
          </div>
          <div className="xp_bar_bg_container">
            <span>{player.cooldown}</span>
            <div className="xp_bar_bg">
              <div className="cooldown_bar" style={cooldownBarStyle}></div>
            </div>
          </div>
        </div>
        <div className="flex width_half justify_between padding_8 padding_top_16 gap_24 padding_right_16">
          <div className="width_full">
            <p className="hud_actions_title">Items</p>
            <div className="grid player_hud_action_container gap_4 padding_y_4">
              {Array.from({ length: 6 }, (_, idx) => (
                <div className="player_hud_skills flex items_center justify_center relative" key={idx}>
                  <ActionItem
                    action={spells[player.spells[idx]]}
                    index={idx}
                    clickedIndex={this.state.clickedSpell}
                    canAct={canAct}
                    actionType={InventoryType.CONSUMABLES}
                    onActionClick={this.actionClick.bind(this)}
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
                  onClick={this.actionClick.bind(this)}>
                  <ActionItem
                    action={items[player.items[idx]]}
                    index={idx}
                    clickedIndex={this.state.clickedSpell}
                    canAct={canAct}
                    actionType={InventoryType.SKILLS}
                    onActionClick={this.actionClick.bind(this)}
                    key={idx}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default PlayerTab;