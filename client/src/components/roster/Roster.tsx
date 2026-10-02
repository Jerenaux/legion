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

    return (
      <div className="rosterContainer">
        <div className="roster-heading">
          <h1>Team composition</h1>
          {this.context.player.isLoaded && <span>{characters.length} / {MAX_CHARACTERS} characters{!remainingSlots && ' · Team full'}</span>}
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
            {Array.from({length: remainingSlots}, (_, index) => {
              const contents = <>
                <span className="roster-slot-number">Slot {characters.length + index + 1}</span>
                <span className="roster-future-portrait" aria-hidden="true"
                  style={{backgroundImage: `url(${getSpritePath(['1_1', '1_7', '1_5'][index % 3])})`}} />
                <span className="roster-slot-plus" aria-hidden="true">+</span>
                <span>{canRecruit ? 'Add character' : 'Future recruit'}</span>
              </>;
              return canRecruit
                ? <Link key={index} href="/shop/characters" className="roster-slot roster-slot--available" data-game-control
                    aria-label={`Recruit character for slot ${characters.length + index + 1}`}>{contents}</Link>
                : <div key={index} className="roster-slot">{contents}</div>;
            })}
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
        {this.context.player.isLoaded && characters.length > 0 && remainingSlots > 0 && (
          <section className="roster-recruitment" aria-labelledby="recruitment-title">
            <div className="roster-recruitment-copy">
              <h2 id="recruitment-title">{canRecruit ? 'Your next teammate awaits' : 'Grow your team'}</h2>
              <p>Recruit warriors and mages with gold. Build a team of up to {MAX_CHARACTERS} characters.</p>
            </div>
            {canRecruit ? <Link href="/shop/characters" className="roster-recruit-link" data-game-control>
              Recruit characters <span aria-hidden="true">→</span>
            </Link> : <div className="roster-unlock">
              <div className="roster-unlock-label"><img src={lockIcon} alt="" /> Recruitment unlocks at {requiredGames} games</div>
              <progress value={completedGames} max={requiredGames} aria-label="Completed games towards recruitment" />
              <div className="roster-unlock-detail"><span>{completedGames} / {requiredGames} completed</span><strong>{gamesLeft} {gamesLeft === 1 ? 'game' : 'games'} to go</strong></div>
              <p>Wins and losses both count.</p>
            </div>}
          </section>
        )}
      </div>
    );
  }
}

export default Roster;