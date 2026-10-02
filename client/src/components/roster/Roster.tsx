import { h, Fragment } from 'preact';
// Roster.tsx
import './Roster.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import { Component } from 'preact';
import CharacterCard from '../HUD/CharacterCard';
import { Link } from 'preact-router';
import { LockedFeatures } from '@legion/shared/enums';
import { APICharacterData } from '@legion/shared/interfaces';
import Skeleton from 'react-loading-skeleton';
import {LOCKED_FEATURES, MAX_CHARACTERS} from '@legion/shared/config';
import {getSpritePath} from '../utils';
import lockIcon from '@assets/lock.png';
import { PlayerContext } from '../../contexts/PlayerContext';


class Roster extends Component {
  static contextType = PlayerContext;

  render() {
    const characters = this.context.characters as APICharacterData[];
    const remainingSlots = Math.max(0, MAX_CHARACTERS - characters.length);
    const canRecruit = this.context.canAccessFeature(LockedFeatures.CHARACTER_PURCHASES);
    const requiredGames = LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES];
    const gamesLeft = this.context.getGamesUntilFeature(LockedFeatures.CHARACTER_PURCHASES);
    const completedGames = Math.min(requiredGames, this.context.getCompletedGames());

    const recruitContent = <>
      <span className="roster-future-portrait" aria-hidden="true" style={{backgroundImage: `url(${getSpritePath('1_1')})`}} />
      <span className="roster-slot-plus" aria-hidden="true">+</span>
      <span>{canRecruit ? 'Recruit character' : 'Next recruit'}</span>
    </>;

    return (
      <div className="rosterContainer">
        <div className="roster-heading">
          <h1>Team composition</h1>
          {this.context.player.isLoaded && <div className="roster-capacity" role="img" aria-label={`${characters.length} of ${MAX_CHARACTERS} characters${!remainingSlots ? ', team full' : ''}`}>
            <span className="roster-capacity-marks" aria-hidden="true">
              {Array.from({length: MAX_CHARACTERS}, (_, index) => <span key={index} className={index < characters.length ? 'is-filled' : ''} />)}
            </span>
            <span aria-hidden="true"><strong>{characters.length}</strong> / {MAX_CHARACTERS}{!remainingSlots && ' · Full'}</span>
          </div>}
        </div>
        {characters.length > 0 ? (
          <div className="rosters">
            {characters.map(character => (
              <CharacterCard
                key={character.id}
                member={character}
                hideXP={true}
                isClickable={true}
                showSPBadge={true}
              />
            ))}
            {remainingSlots > 0 && (canRecruit
              ? <Link href="/shop/characters" className="roster-slot roster-slot--available" data-game-control>{recruitContent}</Link>
              : <div className="roster-slot">{recruitContent}</div>)}
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
        {this.context.player.isLoaded && characters.length > 0 && remainingSlots > 0 && !canRecruit && (
          <div className="roster-unlock">
            <div className="roster-unlock-label"><img src={lockIcon} alt="" />
              <span>Recruitment unlocks in <strong>{gamesLeft} {gamesLeft === 1 ? 'game' : 'games'}</strong></span>
            </div>
            <progress value={completedGames} max={requiredGames}
              aria-label={`${completedGames} of ${requiredGames} games completed. Wins and losses both count.`}
              title={`${completedGames} of ${requiredGames} games completed. Wins and losses both count.`} />
          </div>
        )}
      </div>
    );
  }
}

export default Roster;