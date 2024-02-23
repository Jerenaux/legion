// Roster.tsx
import { h, Component } from 'preact';
import CharacterCard from './CharacterCard';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';

interface RosterState {
  characters: any[];
}

class Roster extends Component<object, RosterState> {

  componentDidMount() {
    this.fetchRosterData();
  }

  async fetchRosterData() {
    try {
        // const data = await apiFetch('rosterData');
        // List 3 characters; in practice a player can own between 3 and 10 characters
        const data = {
          "characters": [
            {
              "id": "moPHy7JuKxvKcamrfRvM",
              "skills": [],
              "skill_slots": 0,
              "level": 1,
              "stats": {
                "spdef": 8,
                "mp": 20,
                "spatk": 7,
                "def": 11,
                "hp": 100,
                "atk": 11
              },
              "carrying_capacity": 3,
              "name": "resident_jade",
              "xp": 0,
              "inventory": [],
              "portrait": "7_4", // Maps to file path like this: backgroundImage: `url(/sprites/${portrait}.png)`,
              "class": 0 // Can be mapped to string representation of class using `classEnumToString` function
            },
            {
              "id": "SnRpBhO0uad6qF4SlIZI",
              "skills": [
                1
              ],
              "skill_slots": 3,
              "level": 1,
              "stats": {
                "spdef": 8,
                "mp": 30,
                "spatk": 11,
                "def": 7,
                "hp": 80,
                "atk": 7
              },
              "carrying_capacity": 3,
              "name": "working_chocolate",
              "xp": 0,
              "inventory": [],
              "portrait": "2_8",
              "class": 1
            },
            {
              "id": "WqYLnK7UwdZrug56DjuN",
              "skills": [
                0,
                2,
                3
              ],
              "skill_slots": 3,
              "level": 1,
              "stats": {
                "spdef": 9,
                "mp": 40,
                "spatk": 10,
                "def": 8,
                "hp": 80,
                "atk": 6
              },
              "carrying_capacity": 3,
              "name": "dual_silver",
              "xp": 0,
              "inventory": [],
              "portrait": "3_2",
              "class": 2
            }
          ]
        };
        console.log(data);
        this.setState({ 
          characters: data.characters
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
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