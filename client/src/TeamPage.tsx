// PlayPage.tsx
import { h, Component } from 'preact';
import CharacterCard from './CharacterCard';

class TeamPage extends Component {
  render() {
    const characters = [
        { portrait: 'assets/sprites/1_1.png', name: 'Character 1', class: 'Warrior', level: 10 },
        { portrait: 'assets/sprites/1_2.png', name: 'Character 2', class: 'Black Mage', level: 15 },
      ];
    return (
        <div>
          <div className="page-header">
            <img src="assets/team.png" className="page-icon" />
            <h1 className="page-title">Team</h1>
          </div>
          <div className="team-content">
            <div className="section-title">Team composition</div> 
            <div className="roster">
                {characters.map(character => <CharacterCard {...character} />)}
            </div>
          </div>
        </div>
      );
  }
}

export default TeamPage;