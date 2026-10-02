import { h } from 'preact';
// Roster.tsx
import './Roster.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import { Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import { route } from 'preact-router';
import { Class, ClassLabels } from '@legion/shared/enums';
import { APICharacterData } from '@legion/shared/interfaces';
import Skeleton from 'react-loading-skeleton';
import { PlayerContext } from '../../contexts/PlayerContext';
import { getSpritePath } from '../utils';


class Roster extends Component {
  static contextType = PlayerContext;

  render() {
    const characters = this.context.characters as APICharacterData[];
    const activeCharacter = this.context.getActiveCharacter();

    return (
      <div className="rosterContainer">
        <BottomBorderDivider label="TEAM COMPOSITION" />
        {characters.length > 0 ? (
          <div className="rosters">
            {characters.map(character => (
              <button type="button" data-game-control
                key={character.id}
                className="roster-character"
                data-character-id={character.id}
                data-class={Class[character.class]}
                aria-pressed={activeCharacter?.id === character.id}
                onClick={() => route(`/team/${character.id}`)}
              >
                <span className="roster-portrait" aria-hidden="true">
                  <span style={{backgroundImage: `url(${getSpritePath(character.portrait)})`}} />
                </span>
                <span className="roster-identity">
                  <span className="team-class-label">{ClassLabels[character.class]}</span>
                  <span className="roster-name">{character.name}</span>
                  <span className="roster-level">Level {character.level}</span>
                </span>
                {character.sp > 0 && <span className="roster-sp" title={`${character.sp} stat points available`}>+{character.sp} SP</span>}
              </button>
            ))}
          </div>
        ) : (
          <Skeleton
            height={100}
            count={1}
            highlightColor='#0000004d'
            baseColor='#0f1421'
            style={{margin: '2px 0', width: '100%'}}
          />
        )}
      </div>
    );
  }
}

export default Roster;
