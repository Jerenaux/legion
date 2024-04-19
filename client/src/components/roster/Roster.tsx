// Roster.tsx
import './Roster.style.css';
import { h, Component } from 'preact';
import CharacterCard from '../characterCard/CharacterCard';
import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import PlusIcon from '@assets/plus.svg';
import { ShopTabs } from '@legion/shared/enums';

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
        this.setState({ 
          characters: data.characters
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  handleCardClick = () => {
    route(`/shop/${ShopTabs[3].toLowerCase()}`);
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