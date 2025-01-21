import { h, Fragment, Component } from 'preact';
import { ProgressBar } from "react-progressbar-fancy";
import './PlayerBar.style.css';
import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import { statusIcons } from '../utils';
import { StatusEffect } from '@legion/shared/enums';
import { StatusEffects } from '@legion/shared/interfaces';
import { CircularTimer } from './CircularTimer';
import ItemIcon from './NewItemIcon';
import { InventoryType } from '@legion/shared/enums';
import { EventEmitter } from '@solana/wallet-adapter-base';

interface PlayerBarProps {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  hasSpells?: boolean;
  statuses: StatusEffects;
  isPlayerTurn: boolean;
  turnDuration?: number;
  timeLeft?: number;
  turnNumber?: number;
  onPassTurn?: () => void;
  animate?: boolean;
  items?: any[];
  spells?: any[];
  pendingItem?: number | null;
  pendingSpell?: number | null;
  eventEmitter?: EventEmitter;
}

class PlayerBar extends Component<PlayerBarProps> {
  events: EventEmitter;

  constructor(props: PlayerBarProps) {
    super(props);
    this.events = props.eventEmitter;
  }

  handleActionClick = (event: Event, index: number) => {
    event.stopPropagation();
    this.events.emit('itemClick', index);
  }

  renderActionRow(actions: any[], startIndex: number, type: InventoryType) {
    if (!actions?.length) return null;
    
    const goldenGradient = 'linear-gradient(to bottom right, #bf9b30, #1c1f25)';
    const pending = type === InventoryType.CONSUMABLES ? this.props.pendingItem : this.props.pendingSpell;

    return (
      <div className="player_bar_action_row">
        <div className="player_bar_actions">
          {actions.map((action, idx) => (
            <div 
              key={idx}
              className={`player_bar_action ${pending === idx ? 'pending-action' : ''}`}
              style={{
                background: 'initial',
              }}
              onClick={(event: Event) => this.handleActionClick(event, startIndex + idx)}
            >
              <ItemIcon
                action={action}
                index={idx}
                canAct={type === InventoryType.CONSUMABLES || (action?.cost <= this.props.mp)}
                actionType={type}
              />
              <span className="player_bar_action_name">{action.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  render({ hp, maxHp, mp, maxMp, hasSpells, statuses, isPlayerTurn, 
          turnDuration, timeLeft, turnNumber, onPassTurn, animate = true,
          items = [], spells = [], pendingSpell }: PlayerBarProps) {
     // Add mock values for each status effect (DO NOT REMOVE)
    statuses = {
      [StatusEffect.FREEZE]: 1,
      [StatusEffect.BURN]: 2,
      [StatusEffect.POISON]: 3,
      [StatusEffect.SLEEP]: 4,
      [StatusEffect.PARALYZE]: 5,
      [StatusEffect.MUTE]: 0,
      [StatusEffect.HASTE]: 7,
    };
    const isMuted = statuses[StatusEffect.MUTE] > 0;
    const pendingSpellCost = pendingSpell !== null ? spells[pendingSpell]?.cost : 0;

    return (
      <div className={`player_bar_container ${animate ? '' : 'no-progress-animation'}`}>
        <div className="player_bar">
          {isPlayerTurn ? (
            <>
              <div className="player_bar_turn_info">
                {/* <div className="player_bar_turn_banner">
                  Your Turn!
                </div> */}
                <div className="player_bar_controls">
                  <CircularTimer 
                    turnDuration={turnDuration}
                    timeLeft={timeLeft}
                    turnNumber={turnNumber}
                  />
                  <button className="player_bar_pass_turn" onClick={onPassTurn}>
                    <span>Pass</span>
                    <span>Turn</span>
                  </button>
                </div>
              </div>
              <div className="player_bar_stats">
                <div className="player_bar_stat">
                  <div className="player_bar_stat_icon">
                    <img src={hpIcon} alt="HP" />
                    <span>HP</span>
                  </div>
                  <ProgressBar 
                    score={(hp / maxHp)*100} 
                    hideText={true} 
                    primaryColor={'#2E7D32'} 
                    secondaryColor={'#4CAF50'} 
                  />
                  <p className="player_bar_stat_value">
                    <span style={{color: '#71deff'}}>{hp}</span> / <span>{maxHp}</span>
                  </p>
                  <div className="player_bar_statuses">
                    {Object.keys(statuses).map((status: string) => statuses[status] !== 0 && (
                      <div key={status}>
                        <img src={statusIcons[status]} alt="" />
                        <span>{statuses[status] === -1 ? '∞' : statuses[status]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {hasSpells && (
                  <div className="player_bar_stat">
                    <div className="player_bar_stat_icon">
                      <img src={mpIcon} alt="MP" />
                      <span>MP</span>
                    </div>
                    <ProgressBar 
                      score={(mp / maxMp)*100} 
                      hideText={true} 
                      primaryColor={'#1565C0'} 
                      secondaryColor={'#2196F3'} 
                    />
                    <p className="player_bar_stat_value">
                      <span style={{
                        color: pendingSpellCost > 0 ? '#ff6b6b' : '#71deff'
                      }}>
                        {pendingSpellCost > 0 ? mp - pendingSpellCost : mp}
                      </span>
                      <span> / </span>
                      <span>{maxMp}</span>
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="enemy_turn_banner">
              Enemy Turn
            </div>
          )}
        </div>
        
        {isPlayerTurn && (
          <div className="player_bar_actions_container">
            {this.renderActionRow(items, 26, InventoryType.CONSUMABLES)}
            {hasSpells && (isMuted ? "Character is Silenced!" : this.renderActionRow(spells, 0, InventoryType.SPELLS))}
          </div>
        )}
      </div>
    );
  }
}

export default PlayerBar; 