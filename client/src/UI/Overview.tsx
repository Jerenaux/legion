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
}

interface Team {
  members: Member[];
}

interface Props {
  overview: {
    teams: Team[];
  };
}

class Overview extends Component<Props> {
  render({ overview }: Props) {
    if (!overview) {
      return <div>Loading...</div>; 
    }
    return (
      <div className="overview">
        {overview.teams.map((team, teamIndex) => (
          <div key={teamIndex} className="team">
            {team.members.map((member, memberIndex) => (
              <div key={memberIndex} className="member">
                <img src={member.texture} alt={member.name} />
                <div>Name: {member.name}</div>
                <div>HP: {member.hp} / {member.maxHP}</div>
                <div>MP: {member.mp} / {member.maxMP}</div>
                <div>Status: {member.isAlive ? 'Alive' : 'Dead'}</div>
                <div>{member.isPlayer ? 'Player' : 'NPC'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
}

export default Overview;