import { h, Fragment, Component } from 'preact';
import { ProgressBar } from "react-progressbar-fancy";
import './PlayerBar.style.css';
import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import { statusIcons } from '../utils';
import { StatusEffect } from '@legion/shared/enums';
import { StatusEffects } from '@legion/shared/interfaces';
import { CircularTimer } from './CircularTimer';

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
}

class PlayerBar extends Component<PlayerBarProps> {
  render({ hp, maxHp, mp, maxMp, hasSpells, statuses, isPlayerTurn, 
          turnDuration, timeLeft, turnNumber, onPassTurn, animate = true }: PlayerBarProps) {
     // Add mock values for each status effect (DO NOT REMOVE)
    statuses = {
      [StatusEffect.FREEZE]: 1,
      [StatusEffect.BURN]: 2,
      [StatusEffect.POISON]: 3,
      [StatusEffect.SLEEP]: 4,
      [StatusEffect.PARALYZE]: 5,
      [StatusEffect.MUTE]: 6,
      [StatusEffect.HASTE]: 7,
    };
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
                      <span style={{color: '#71deff'}}>{mp}</span> / <span>{maxMp}</span>
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
      </div>
    );
  }
}

export default PlayerBar; 