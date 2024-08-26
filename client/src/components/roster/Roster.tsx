// Roster.tsx
import './Roster.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component } from 'preact';
import CharacterCard from '../characterCard/CharacterCard';
import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import PlusIcon from '@assets/plus.svg';
import { ShopTabs } from '@legion/shared/enums';
import Skeleton from 'react-loading-skeleton';
import { APICharacterData } from '@legion/shared/interfaces';

interface RosterState {
  characters: APICharacterData[];
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
        {this.state.characters ? <div className="rosters">
            {this.state.characters && this.state.characters.map(character => <CharacterCard {...character} key={character} />)}
            <div className="addCardContainer">
              <div className="addCard" onClick={this.handleCardClick}>
                <img src={PlusIcon} alt="Plus" />
              </div>
            </div>
        </div> : <Skeleton height={100} count={1} highlightColor='#0000004d' baseColor='#0f1421' style={{margin: '2px 0', width: '1024px'}}/>}
      </div>
    );
  }
}

export default Roster;