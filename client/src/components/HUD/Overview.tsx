// Overview.tsx
import { h, Component } from 'preact';
import { PlayerProps, TeamMember } from "@legion/shared/interfaces";
import PlayerInfo from './PlayerInfo';

interface Props {
  members: TeamMember[];
  score: number;
  position: string;
  isSpectator: boolean;
  selectedPlayer: PlayerProps;
  eventEmitter: any;
  isPlayerTeam: boolean;
}

interface State {
  cooldowns: number[];
  previousHPs: number[];
  blinking: boolean[];
  selected: number;
}

class Overview extends Component<Props, State> {
  timerID: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      cooldowns: props.members
        ? props.members.map(member => member.cooldown)
        : [],
      previousHPs: props.members
        ? props.members.map(member => member.hp)
        : [],
      blinking: props.members
        ? props.members.map(() => false)
        : [],
      selected: null
    };
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 10);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.members !== prevProps.members && this.props.members) {
      const cooldowns = this.props.members.map(member => member.cooldown);
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
      this.setState({ cooldowns, previousHPs, blinking });
    }
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  tick() {
    this.setState(prevState => ({
      cooldowns: prevState.cooldowns.map(cooldown => Math.max(0, cooldown - 10))
    }));
  }

  render({ members, position, selectedPlayer, isSpectator }: Props, { cooldowns, blinking }: State) {
    if (!members || !blinking.length) {
      return <div />;
    }
    let cooldownIndex = 0;

    const playerTabData: any = {
      avatar: members[this.state.selected]?.texture ?? '1_1',
      level: 1,
      rank: this.state.selected,
      name: members[this.state.selected]?.name ?? 'Player Name'
    }

    return (
      <div className={`overview ${position === 'right' && 'overview_right'}`}>
        <PlayerInfo player={playerTabData} position={this.props.position} isSpectator={isSpectator} eventEmitter={this.props.eventEmitter} />
        {members.map((member, memberIndex) => {
          const cooldown = cooldowns[cooldownIndex++];

          const portraitStyle = {
            backgroundImage: `url(/sprites/${member.texture}.png)`,
          };

          const charProfileStyle = (idx: number) => {
            const isSelected = this.props.selectedPlayer?.number === idx + 1 && this.props.isPlayerTeam;

            if (cooldown === 0 && member.hp > 0) {
              return {
                backgroundImage: 'url(/HUD/char_profile_ready.png)',
                transform: 'scale(1.1)'
              }
            }

            return {
              backgroundImage: `url(/HUD/char_profile_${isSelected ? 'active' : 'idle'}.png)`,
              filter: `grayscale(${member.hp > 0 ? '0' : '1'})`
            }
          }

          const charStatStyle = (idx: number) => {
            const isSelected = this.props.selectedPlayer?.number === idx + 1 && this.props.isPlayerTeam;

            return {
              backgroundImage: `url(/HUD/char_stats_bg${isSelected ? '_Active' : ''}.png)`,
            }
          }

          return (
            <div
              key={memberIndex}
              className={`member char_stats_container ${position === 'right' && 'flex_row_reverse'}`}
            >
              <div className='char_profile_container' style={charProfileStyle(memberIndex)}>
                <div className={`char_portrait ${position === 'left' ? 'flip' : 'char_portrait_right'} ${member.hp > 0 ? 'char_alive_animation' : ''}`} style={portraitStyle} />
              </div>
              <div className={`char_stats ${position === 'right' && 'char_stats_right'}`} style={charStatStyle(memberIndex)}>
                <div className="char_stats_player_name">
                  <div className="char_stats_player_index">
                    <span>{memberIndex + 1}</span>
                  </div>
                  <p>{member.name}</p>
                </div>
                <div className="char_stats_bar" style={position === 'left' && {justifyContent: 'flex-start'}}>
                  <div className="char_stats_hp" style={{ width: `${(member.hp / member.maxHP) * 100}%` }}></div>
                </div>
                {this.props.isPlayerTeam && <div className="char_stats_bar" style={position === 'left' && {justifyContent: 'flex-start'}}>
                  <div className="char_stats_mp" style={{ width: `${(member.mp / member.maxMP) * 100}%` }}></div>
                </div>}
              </div>
              {this.props.isPlayerTeam && <div className={`char_stats_cooldown_bar ${member.totalCooldown && cooldown === 0 ? 'cooldown_bar_flash' : ''}`} style={position === 'left' && {justifyContent: 'flex-start'}}>
                <div className="char_stats_cooldown" style={{ width: `${(1 - (cooldown / member.totalCooldown)) * 100}%` }}></div>
              </div>}
              <div className={`char_statuses ${position === 'right' && 'char_statuses_right'}`}>
                {Object.keys(member?.statuses).map((status: string) => {
                    return member.statuses[status] !== 0 && <img key={`${memberIndex}-${status}`} src={`/HUD/${status}_icon.png`} alt="" />
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}

export default Overview;