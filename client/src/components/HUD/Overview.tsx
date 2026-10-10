import {t, formatNumber} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import { PlayerProps, TeamMember, PlayerProfileData } from "@legion/shared/interfaces";
import PlayerInfo from './PlayerInfo';
import ClassCrest from './ClassCrest';
import { CharacterHover, InspectCharacter } from './CharacterHoverCard';
import { PlayMode, StatusEffect } from '@legion/shared/enums';
import { getSpritePath, statusIcons } from '../utils';
import './Overview.style.css';

import charProfileReady from '@assets/HUD/char_profile_ready.png';
import charProfileActive from '@assets/HUD/char_profile_active.png';
import charProfileIdle from '@assets/HUD/char_profile_idle.png';
import charStatsBgActive from '@assets/HUD/char_stats_bg_Active.png';
import charStatsBg from '@assets/HUD/char_stats_bg.png';
import { EventEmitter } from 'eventemitter3';
interface Props {
  teamId: number;
  characterHover: CharacterHover | null;
  onInspect: InspectCharacter;
  members: TeamMember[];
  position: string;
  selectedPlayer: PlayerProps;
  eventEmitter: EventEmitter;
  isPlayerTeam: boolean;
  player: PlayerProfileData;
  mode: PlayMode;
  /** Both players belong to the same creator community. */
  sharedCommunity?: boolean;
}

interface State {
  previousHPs: number[];
  blinking: boolean[];
  selected: number;
}

class Overview extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      previousHPs: props.members
        ? props.members.map(member => member.hp)
        : [],
      blinking: props.members
        ? props.members.map(() => false)
        : [],
      selected: null
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.members !== prevProps.members && this.props.members) {
      const previousHPs = this.state.previousHPs;
      const blinking = this.state.blinking;
      this.props.members.forEach((member, memberIndex) => {
        if (blinking[memberIndex] === undefined) {
          blinking[memberIndex] = false;
        }
        if (member.hp < previousHPs[memberIndex]) {
          blinking[memberIndex] = true;
          setTimeout(() => {
            blinking[memberIndex] = false;
            this.setState({ blinking });
          }, 750); // blink for 500ms
        }
        previousHPs[memberIndex] = member.hp;
      });
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ previousHPs, blinking });
    }
  }

  render({ members, position }: Props, { blinking }: State) {
    if (!members || !blinking.length) {
      return <div />;
    }

    return (
      <div className={`overview ${this.props.isPlayerTeam && 'overview_playerteam'} ${position === 'right' && 'overview_right'}`}>
        <PlayerInfo player={this.props.player} isPlayerTeam={this.props.isPlayerTeam} position={this.props.position} eventEmitter={this.props.eventEmitter} sharedCommunity={this.props.sharedCommunity} />
        <div className="member_container">
          <div className="team_label">
            {this.props.isPlayerTeam ? t("Your team") : t("Enemy team")}
          </div>
          {members.map((member, memberIndex) => {
            const isAlive = member.hp > 0;
            const { teamId, characterHover, onInspect } = this.props;
            const inspected = characterHover?.team === teamId && characterHover.num === memberIndex + 1;

            const portraitStyle = {
              backgroundImage: `url(${getSpritePath(member.portrait)})`,
            };

            const charProfileStyle = (idx: number) => {
              const isSelected = this.props.selectedPlayer?.number === idx + 1 && this.props.isPlayerTeam;

              const isTurnee = false;
              if (isTurnee && isAlive) {
                return {
                  backgroundImage: `url(${charProfileReady})`,
                  transform: 'scale(1.1)'
                }
              }

              return {
                backgroundImage: `url(${isSelected ? charProfileActive : charProfileIdle})`,
                filter: `grayscale(${member.hp > 0 ? '0' : '1'})`
              }
            }

            const charStatStyle = (idx: number) => {
              const isSelected = this.props.selectedPlayer?.number === idx + 1 && this.props.isPlayerTeam;

              return {
                backgroundImage: `url(${isSelected ? charStatsBgActive : charStatsBg})`,
              }
            }

            return (
              <button type="button" data-game-control
                key={memberIndex}
                onClick={e => onInspect(teamId, memberIndex + 1, e.currentTarget)}
                aria-label={[t("Inspect {{value0}}", {value0: member.name}), Number.isFinite(member.level) ? `${t("Lvl")} ${formatNumber(member.level)}` : ''].filter(Boolean).join(', ')}
                aria-describedby={inspected ? 'character-hover-card' : undefined}
                data-character={`${teamId}-${memberIndex + 1}`}
                data-inspected={inspected}
                onMouseEnter={e => onInspect(teamId, memberIndex + 1, e.currentTarget)}
                onMouseLeave={e => { if (!e.currentTarget.contains(document.activeElement)) onInspect(teamId, memberIndex + 1, null); }}
                onFocus={e => onInspect(teamId, memberIndex + 1, e.currentTarget)}
                onBlur={() => onInspect(teamId, memberIndex + 1, null)}
                className={`member char_stats_container ${position === 'right' && 'flex_row_reverse'}`}
              >
                <div className='char_profile_container' style={charProfileStyle(memberIndex)}>
                  <div className={`char_portrait ${position === 'left' ? 'flip' : 'char_portrait_right'} ${member.hp > 0 ? 'char_alive_animation' : ''}`} style={portraitStyle} />
                  {Number.isFinite(member.level) && <span className="char_level_tag"><small>{t("Lvl")}</small>{formatNumber(member.level)}</span>}
                </div>
                <div className={`char_stats ${position === 'right' && 'char_stats_right'}`} style={charStatStyle(memberIndex)}>
                  <div className="overview_class_crest">
                    <ClassCrest characterClass={member.class} />
                  </div>
                  <div className="char_stats_player_name">
                    <div className="char_stats_player_index">
                      <span>{memberIndex + 1}</span>
                    </div>
                    <p>{member.name}</p>
                  </div>
                  <div className="char_stats_bar" style={position === 'left' && { justifyContent: 'flex-start' }}>
                    <div className="char_stats_hp" style={{ width: `${(member.hp / member.maxHP) * 100}%` }}></div>
                  </div>
                  {Number.isFinite(member.mp) && member.maxMP > 0 && <div className="char_stats_bar" style={position === 'left' && { justifyContent: 'flex-start' }}>
                    <div className="char_stats_mp" style={{ width: `${(member.mp / member.maxMP) * 100}%` }}></div>
                  </div>}
                </div>
                <div className={`char_statuses ${position === 'right' && 'char_statuses_right'}`}>
                  {Object.keys(member?.statuses).map((status: StatusEffect) => {
                    return member.statuses[status] !== 0 && <img key={`${memberIndex}-${status}`} src={statusIcons[status]}  alt={""} />
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

export default Overview;
