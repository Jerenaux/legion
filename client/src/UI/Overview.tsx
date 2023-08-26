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

interface Team {
  members: Member[];
}

interface Props {
  overview: {
    teams: Team[];
  };
}

interface State {
  cooldowns: number[];
  previousHPs: number[][];
  blinking: boolean[][];
}

class Overview extends Component<Props, State> {
  timerID: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      cooldowns: props.overview 
        ? props.overview.teams.flatMap(team => team.members.map(member => member.cooldown))
        : [],
      previousHPs: props.overview 
        ? props.overview.teams.map(team => team.members.map(member => member.hp))
        : [],
      blinking: props.overview 
        ? props.overview.teams.map(team => team.members.map(() => false))
        : []
    };
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 10);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.overview !== prevProps.overview && this.props.overview) {
      const cooldowns = this.props.overview.teams.flatMap(team => team.members.map(member => member.cooldown));
      const previousHPs = this.state.previousHPs;
      const blinking = this.state.blinking;
      this.props.overview.teams.forEach((team, teamIndex) => {
        if (!blinking[teamIndex]) {
          blinking[teamIndex] = [];
        }
        if (!previousHPs[teamIndex]) {
          previousHPs[teamIndex] = [];
        }
        team.members.forEach((member, memberIndex) => {
          if (blinking[teamIndex][memberIndex] === undefined) {
            blinking[teamIndex][memberIndex] = false;
          }
          if (member.hp < previousHPs[teamIndex][memberIndex]) {
            blinking[teamIndex][memberIndex] = true;
            setTimeout(() => {
              blinking[teamIndex][memberIndex] = false;
              this.setState({ blinking });
            }, 750); // blink for 500ms
          }
          previousHPs[teamIndex][memberIndex] = member.hp;
        });
      });
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

  render({ overview }: Props, { cooldowns, blinking }: State) {
    if (!overview || !blinking.length) {
      return <div></div>; 
    }
    let cooldownIndex = 0;
    return (
      <div className="overview box">
        {overview.teams.map((team, teamIndex) => (
          <div key={teamIndex} className="team">
            {team.members.map((member, memberIndex) => {
              const portraitStyle = {
                backgroundImage: `url(assets/sprites/${member.texture})`,
                backgroundPosition: '-45px -45px',
                backgroundRepeat: 'no-repeat',
                filter: member.isAlive ? 'none' : 'grayscale(100%)'
              };
              const cooldown = cooldowns[cooldownIndex++];
              return (
                <div key={memberIndex} className="member">
                  <div style={portraitStyle} className={`member-portrait ${blinking[teamIndex][memberIndex] ? 'blink' : ''}`} >
                   {member.isPlayer && <span className="member-index">{memberIndex + 1}</span>}
                  </div>
                  <div className="member-name">Player #{memberIndex + 1}</div>
                  <div className="hp-bar">
                    <div className="hp-fill" style={{width: `${(member.hp / member.maxHP) * 100}%`}}></div>
                  </div>
                  {member.isPlayer && (
                    <div className="mp-bar">
                      <div className="mp-fill" style={{width: `${(member.mp / member.maxMP) * 100}%`}}></div>
                    </div>
                  )}
                  {member.isPlayer && (
                  <div className="cooldown-bar">
                    <div className="cooldown-fill" style={{width: `${(1 - (cooldown / member.totalCooldown)) * 100}%`}}></div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
}

export default Overview;