import { h, Component } from 'preact';
import ActionItem from './Action';
import { InventoryType, Target } from '@legion/shared/enums';
import TabBar from './TabBar';
import { Player } from './GameHUD';
import { mapFrameToCoordinates } from '../../utils';
import { BaseSpell } from '@legion/shared/BaseSpell';

interface Props {
  player: Player;
  eventEmitter: any;
}

interface State {
  player: Player;
  clickedItem: number;
  clickedSpell: number;
  poisonCounter: number;
  frozenCounter: number;
  selectedSpell: BaseSpell;
  backgroundPosition: string;
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
      poisonCounter: 25,
      frozenCounter: 15,
      backgroundPosition: '',
      selectedSpell: null,
    };
    this.events = this.props.eventEmitter;
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  tick() {
    this.setState(prevState => ({
      poisonCounter: Math.max(0, prevState.poisonCounter - 1),
      frozenCounter: Math.max(0, prevState.frozenCounter - 1)
    }))
  }

  actionClick(type: string, index: number) {
    this.events.emit('itemClick', index);

    if (type == 'item') {
      console.log(this.state.player.items[index]?.name);
    } else {
      console.log(this.state.player.spells[index]?.name);
    }

    const stateField = type == 'item' ? 'clickedItem' : 'clickedSpell';
    this.setState({ [stateField]: index });

    if (type !== 'item') {
      const coordinates = mapFrameToCoordinates(this.props.player.spells[index]?.frame);
      coordinates.x = -coordinates.x + 0;
      coordinates.y = -coordinates.y + 0;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;
      this.setState({ backgroundPosition, selectedSpell: this.props.player.spells[index]});
    }

    setTimeout(() => {
      this.setState({ [stateField]: -1 });
    }, 1000);
  }

  getCooldownRatio(player: Player): number {
    return (player.maxCooldown - player.cooldown) / player.maxCooldown;
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
    const headerText = `#${player.number} ${player.name}`;
    const cooldownRatio = this.getCooldownRatio(player);
    const cooldownBarStyle = {
      width: `${cooldownRatio * 100}%`,
    };

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
                  <div>
                    <img src="/HUD/poison_icon.png" alt="" />
                    <span>{this.state.poisonCounter}</span>
                  </div>
                  <div>
                    <img src="/HUD/frozen_icon.png" alt="" />
                    <span>{this.state.frozenCounter}</span>
                  </div>
                  <div style={{ fontSize: '18px', lineHeight: '10px' }}>
                    <img src="/HUD/burning_icon.png" alt="" />
                    <span>&infin;</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="xp_bar_bg_container">
              <img src="/inventory/cd_icon.png" alt="" />
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
                  <div className="player_hud_skills flex items_center justify_center relative" key={idx}
                    onClick={() => this.actionClick('item', idx)}>
                    <ActionItem
                      action={player.items[idx]}
                      index={idx}
                      clickedIndex={this.state.clickedSpell}
                      canAct={canAct}
                      actionType={InventoryType.CONSUMABLES}
                      onActionClick={() => { }}
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
                    onClick={() => this.actionClick('spell', idx)}>
                    <ActionItem
                      action={player.spells[idx]}
                      index={idx}
                      clickedIndex={this.state.clickedSpell}
                      canAct={canAct}
                      actionType={InventoryType.SKILLS}
                      onActionClick={() => { }}
                      key={idx}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {this.state.clickedSpell > -1 && <div className="spell_target_container">
          <div className="spell_target">
            <div className="equip-dialog-image" style={{
              backgroundImage: `url(spells.png)`,
              backgroundPosition: this.state.backgroundPosition,
            }} />
            <div className="dialog-spell-info-container">
            <div className="dialog-spell-info">
              <img src={'/inventory/mp_icon.png'} alt="mp" />
              <span>{this.state.selectedSpell?.cost}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/cd_icon.png'} alt="cd" />
              <span>{this.state.selectedSpell?.cooldown}s</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/target_icon.png'} alt="target" />
              <span>{Target[this.state.selectedSpell?.target]}</span>
            </div>
          </div>
          </div>
        </div>}
      </div>
    );
  }
}

export default PlayerTab;