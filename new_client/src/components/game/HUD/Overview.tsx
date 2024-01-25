// Overview.tsx
import { h, Component } from 'preact';

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
  score: number;
  position: string;
}

interface State {
  cooldowns: number[];
  previousHPs: number[];
  blinking: boolean[];
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
        : []
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

  render({ members, score, position }: Props, { cooldowns, blinking }: State) {
    if (!members || !blinking.length) {
      return <div />; 
    }
    let cooldownIndex = 0;
    return (
      <div className="overview">
          {members.map((member, memberIndex) => {
            const portraitStyle = {
              backgroundImage: `url(assets/sprites/${member.texture}.png)`,
              backgroundPosition: '-45px -45px',
              backgroundRepeat: 'no-repeat',
              filter: member.isAlive ? 'none' : 'grayscale(100%)',
              transform: position === 'left' ? 'scaleX(-1)' : 'none'
            };
            const cooldown = cooldowns[cooldownIndex++];
            return (
              <div key={memberIndex} className={`box member ${position === 'left' ? 'member-left' : 'member-right'}`}>
                <div style={portraitStyle} className={`member-portrait ${blinking[memberIndex] ? 'blink' : ''}`} >
                {member.isPlayer && <span className="member-index">{memberIndex + 1}</span>}
                </div>
                <div className="member-name">{member.name}</div>
                <div className="hp-bar">
                  <div className="hp-fill" style={{width: `${(member.hp / member.maxHP) * 100}%`}} />
                </div>
                {member.isPlayer && (
                  <div className="mp-bar">
                    <div className="mp-fill" style={{width: `${(member.mp / member.maxMP) * 100}%`}} />
                  </div>
                )}
                {member.isPlayer && (
                <div className="cooldown-bar">
                  <div className="cooldown-fill" style={{width: `${(1 - (cooldown / member.totalCooldown)) * 100}%`}} />
                </div>
                )}
              </div>
            );
          })}
      </div>
    );
  }
}

export default Overview;