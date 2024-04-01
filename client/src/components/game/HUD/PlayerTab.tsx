import { h, Component } from 'preact';
import ActionItem from './Action';
import { InventoryType } from '@legion/shared/enums';
import TabBar from './TabBar';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";

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
  spells: BaseSpell[];
  items: BaseItem[];
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
        backgroundImage: `url(assets/sprites/${player.portrait}.png)`,
      };
      const isCooldownActive = player.cooldown > 0;
      const isDead = player.hp <= 0;
      const canAct = !isCooldownActive && !isDead && !player.casting;
      const headerText = `#${player.number} ${player.name}`;
      const cooldownRatio = this.getCooldownRatio(player);
      const cooldownBarStyle = {
        width: `${cooldownRatio * 100}%`,
      };
  
      return <div className="player-tab">
          <div className="character-header-arena">
            <div className="character-header-name">{headerText}</div>
            <div className="character-header-name-shadow">{headerText}</div>
          </div>
          <div className="character-full-content">
            <div className="player-content">
              <div className="character-portrait" style={portraitStyle} />
              <div className="player-bars">
                <div className="">
                  <TabBar title="HP" value={player.hp} maxValue={player.maxHp} barClass="hp-bar" />
                  <TabBar title="MP" value={player.mp} maxValue={player.maxMp} barClass="mp-bar" />
                  <div className="bar-title">Cooldown</div>
                  <div className="xp-bar-bg">
                      <div className="hud-bar cooldown-bar" style={cooldownBarStyle} />
                  </div>
                </div>
              </div>
            </div>
            <div className="hud-actions">
              {player.spells && player.spells.length > 0 && (
                <div className="player-skills">
                  <div className="slots">
                    {player.spells.map((skill, i) => (
                      <ActionItem 
                        action={skill} 
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
                        action={item} 
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
      </div>;
  }
}

export default PlayerTab;