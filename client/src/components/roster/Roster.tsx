// Roster.tsx
import './Roster.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component } from 'preact';
import CharacterCard from '../HUD/XPCountUp';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import { ShopTab } from '@legion/shared/enums';
import { APICharacterData } from '@legion/shared/interfaces';
import Skeleton from 'react-loading-skeleton';
import { PlayerContext } from '../../contexts/PlayerContext';


class Roster extends Component {
  static contextType = PlayerContext; 

  handleCardClick = () => {
    route(`/shop/${ShopTab[3].toLowerCase()}`);
  }

  render() {
    const characters = this.context.characters as APICharacterData[];

    return (
      <div className="rosterContainer">
        <BottomBorderDivider label="TEAM COMPOSITION" />
        {characters.length > 0 ? (
          <div className="rosters">
            {characters.map(character => (
              <CharacterCard 
                key={character.id} 
                member={character}
                hideXP={true}
                isClickable={true}
              />
            ))}
            {/* {
            this.context.characters.length < MAX_CHARACTERS 
            && this.context.canAccessFeature(LockedFeatures.CHARACTER_PURCHASES)
            && <div className="addCardContainer">
              <div className="addCard" onClick={this.handleCardClick}>
                <img src={PlusIcon} alt="Plus" />
              </div>
            </div>} */}
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