// Overview.tsx
import { h, Component } from 'preact';
import { Player } from './GameHUD';
import PlayerInfo from './PlayerInfo';

interface Member {
  texture: string;
  name: string;
  hp: number;
  maxHP: number;
  mp: number;
  maxMP: number;
  isAlive: boolean;
  isPlayer: boolean;
  cooldown: number;
  totalCooldown: number;
}

interface Props {
  members: Member[];
  player: Player;
  score: number;
  position: string;
}

interface State {
  cooldowns: number[];
  previousHPs: number[];
  blinking: boolean[];
  hovered: number;
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
      hovered: null,
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

  render({ members, score, position, player }: Props, { cooldowns, blinking }: State) {
    if (!members || !blinking.length) {
      return <div />;
    }
    let cooldownIndex = 0;

    return (
      <div className="overview">
        <PlayerInfo player={player} />
        {members.map((member, memberIndex) => {
          const portraitStyle = {
            backgroundImage: `url(/sprites/${member.texture}.png)`,
          };

          const charProfileStyle = (idx: number) => {
            if (this.state.selected === idx) {
              return {
                backgroundImage: `url(/HUD/char_profile_ready.png)`
              }
            }
            return {
              backgroundImage: `url(/HUD/char_profile_${this.state.hovered === idx ? 'active' : 'idle'}.png)`
            }
          }

          const charStatStyle = (idx: number) => {
            return {
              backgroundImage: `url(/HUD/char_stats_bg${this.state.hovered === idx ? '_Active' : ''}.png)`
            }
          }

          const cooldown = cooldowns[cooldownIndex++];

          return (
            <div 
            key={memberIndex} 
            className={`member ${position === 'left' ? 'member-left' : 'member-right'} char_stats_container`} 
            onMouseEnter={() => this.setState({hovered: memberIndex})} 
            onMouseLeave={() => this.setState({hovered: null})} 
            onClick={() => this.setState({selected: memberIndex})}>
              <div className='char_profile_container' style={charProfileStyle(memberIndex)}>
                <div className="char_portrait" style={portraitStyle} />
              </div>
              <div className="char_stats" style={charStatStyle(memberIndex)}>
                <div className="char_stats_player_name">
                  <div className="char_stats_player_index">
                    <span>{memberIndex + 1}</span>
                  </div>
                  <p>{member.name}</p>
                </div>
                <div className="char_stats_bar">
                  <div className="char_stats_hp" style={{ width: `${(member.hp / member.maxHP) * 100}%` }}></div>
                </div>
                <div className="char_stats_bar">
                  <div className="char_stats_mp" style={{ width: `${(member.mp / member.maxMP) * 100}%` }}></div>
                </div>
              </div>
              <div className="char_stats_cooldown_bar">
                <div className="char_stats_cooldown" style={{ width: `${(1 - (cooldown / member.totalCooldown)) * 100}%` }}></div>
              </div>
              <div className="char_statuses">
                <img src="/HUD/poison_icon.png" alt="" />
                <img src="/HUD/frozen_icon.png" alt="" />
                <img src="/HUD/burning_icon.png" alt="" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}

export default Overview;