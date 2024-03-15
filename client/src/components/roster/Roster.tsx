// Roster.tsx
import './Roster.style.css';
import { h, Component } from 'preact';
import CharacterCard from '../characterCard/CharacterCard';
import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import PlusIcon from '@assets/plus.svg';

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
        const data = {
          "characters": [
            {
              "id": "moPHy7JuKxvKcamrfRvM",
              "skills": [],
              "skill_slots": 0,
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
              "inventory": [],
              "portrait": "7_4",
              "class": 0,
              "level": 3,
              "allTimeSP": 6,
              "sp": 6,
              "xp": 100
            },
            {
              "id": "SnRpBhO0uad6qF4SlIZI",
              "skills": [
                1
              ],
              "skill_slots": 3,
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
              "inventory": [],
              "portrait": "2_8",
              "class": 1,
              "level": 3,
              "allTimeSP": 6,
              "sp": 6,
              "xp": 100
            },
            {
              "id": "WqYLnK7UwdZrug56DjuN",
              "skills": [
                0,
                2,
                3
              ],
              "skill_slots": 3,
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
              "inventory": [],
              "portrait": "3_2",
              "class": 2,
              "level": 3,
              "allTimeSP": 6,
              "sp": 6,
              "xp": 100
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

  handleCardClick = () => {
    route(`/shop`);
  }

  render() {
    return (
      <div className="rosterContainer">
        <BottomBorderDivider label="TEAM COMPOSITION" />
        <div className="rosters">
            {this.state.characters && this.state.characters.map(character => <CharacterCard {...character} key={character} />)}
            <div className="addCardContainer">
              <div className="addCard" onClick={this.handleCardClick}>
                <img src={PlusIcon} alt="Plus" />
              </div>
            </div>
        </div>
      </div>
    );
  }
}

export default Roster;