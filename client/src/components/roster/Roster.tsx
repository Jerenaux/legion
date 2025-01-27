// Roster.tsx
import './Roster.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component } from 'preact';
import CharacterCard from '../characterCard/CharacterCard';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import PlusIcon from '@assets/plus.svg';
import { LockedFeatures, ShopTab } from '@legion/shared/enums';
import Skeleton from 'react-loading-skeleton';
import { PlayerContext } from '../../contexts/PlayerContext';
import { MAX_CHARACTERS } from "@legion/shared/config";


class Roster extends Component {
  static contextType = PlayerContext; 

  handleCardClick = () => {
    route(`/shop/${ShopTab[3].toLowerCase()}`);
  }

  render() {
    const characters = this.context.characters;

    return (
      <div className="rosterContainer">
        <BottomBorderDivider label="TEAM COMPOSITION" />
        {characters.length > 0 ? (
          <div className="rosters">
            {characters.map(character => (
              <CharacterCard {...character} key={character.id} />
            ))}
            {
            this.context.characters.length < MAX_CHARACTERS 
            && this.context.canAccessFeature(LockedFeatures.CHARACTER_PURCHASES)
            && <div className="addCardContainer">
              <div className="addCard" onClick={this.handleCardClick}>
                <img src={PlusIcon} alt="Plus" />
              </div>
            </div>}
          </div>
        ) : (
          <Skeleton 
            height={100} 
            count={1} 
            highlightColor='#0000004d' 
            baseColor='#0f1421' 
            style={{margin: '2px 0', width: '1024px'}}
          />
        )}
      </div>
    );
  }
}

export default Roster;