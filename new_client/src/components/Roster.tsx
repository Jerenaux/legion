// Roster.tsx
import { h, Component } from 'preact';
import CharacterCard from './CharacterCard';
// import toast from '@brenoroosevelt/toast'
import { apiFetch } from '../services/apiService';

interface RosterState {
  characters: any[];
}

class Roster extends Component<object, RosterState> {

  componentDidMount() {
    this.fetchRosterData();
  }

  async fetchRosterData() {
    try {
        const data = await apiFetch('rosterData');
        console.log(data);
        this.setState({ 
          characters: data.characters
        });
    } catch (error) {
        // toast.error(`Error: ${error}`, {closeBtn: true, position: 'top'});
    }
  }

  render() {
    return (
      <div>
        <div className="section-title">Your Team</div>
        <div className="roster">
            {this.state.characters && this.state.characters.map(character => <CharacterCard {...character} key={character} />)}
        </div>
      </div>
    );
  }
}

export default Roster;