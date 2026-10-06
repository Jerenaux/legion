import {t, i18n, formatNumber} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';
import { h, Fragment } from 'preact';
// Roster.tsx
import './Roster.style.css';

import { Component } from 'preact';
import { Link, route, getCurrentUrl } from 'preact-router';
import { Class, LockedFeatures } from '@legion/shared/enums';
import { APICharacterData } from '@legion/shared/interfaces';
import Ghost from '../ghost/Ghost';
import {LOCKED_FEATURES, MAX_CHARACTERS} from '@legion/shared/config';
import {getSpritePath, classEnumToString} from '../utils';
import lockIcon from '@assets/lock.png';
import { PlayerContext } from '../../contexts/PlayerContext';


class Roster extends Component {
  static contextType = PlayerContext;

  render() {
    const characters = this.context.characters as APICharacterData[];
    const activeCharacter = getCurrentUrl().startsWith('/team') ? this.context.getActiveCharacter() : null;
    const remainingSlots = Math.max(0, MAX_CHARACTERS - characters.length);
    const canRecruit = this.context.canAccessFeature(LockedFeatures.CHARACTER_PURCHASES);
    const requiredGames = LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES];
    const gamesLeft = this.context.getGamesUntilFeature(LockedFeatures.CHARACTER_PURCHASES);
    const completedGames = Math.min(requiredGames, this.context.getCompletedGames());

    const recruitContent = <>
      <span className="roster-future-portrait" aria-hidden="true" style={{backgroundImage: `url(${getSpritePath('1_1')})`}} />
      <span className="roster-slot-plus" aria-hidden="true">+</span>
      <span>{canRecruit ? t("Recruit character") : t("Next recruit")}</span>
    </>;

    return (
      <div className="rosterContainer">
        <div className="roster-heading">
          <h1>{t("Team composition")}</h1>
          {this.context.player.isLoaded && <div className="roster-capacity" role="img" aria-label={t(remainingSlots ? "rosterCapacity" : "rosterFull", {count: characters.length, max: MAX_CHARACTERS})}>
            <span className="roster-capacity-marks" aria-hidden="true">
              {Array.from({length: MAX_CHARACTERS}, (_, index) => <span key={index} className={index < characters.length ? 'is-filled' : ''} />)}
            </span>
            <span aria-hidden="true"><strong>{characters.length}</strong> / {MAX_CHARACTERS}{!remainingSlots && t(' · Full')}</span>
          </div>}
        </div>
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
                  <span className="team-class-label">{classEnumToString(character.class)}</span>
                  <span className="roster-name" title={character.name}>{character.name}</span>
                  <span className="roster-level">{t("Lvl")} {formatNumber(character.level)}</span>
                  {character.sp > 0 && <span className="roster-sp" title={t("Spend stat points")}>+{formatNumber(character.sp)} {t("SP")}</span>}
                </span>
              </button>
            ))}
            {remainingSlots > 0 && (canRecruit
              ? <Link href="/shop/characters" className="roster-slot roster-slot--available" data-game-control>{recruitContent}</Link>
              : <div className="roster-slot">{recruitContent}</div>)}
          </div>
        ) : (
          <Ghost height={104} count={4} className="ghost-grid" />
        )}
        {this.context.player.isLoaded && characters.length > 0 && remainingSlots > 0 && !canRecruit && (
          <div className="roster-unlock">
            <div className="roster-unlock-label"><img src={lockIcon} alt={""} />
              <span><Trans i18n={i18n} i18nKey="recruitmentUnlock" count={gamesLeft} components={[<strong />]} /></span>
            </div>
            <progress value={completedGames} max={requiredGames}
              aria-label={t("{{value0}} of {{value1}} games completed. Wins and losses both count.", {value0: completedGames, value1: requiredGames})}
              title={t("{{value0}} of {{value1}} games completed. Wins and losses both count.", {value0: completedGames, value1: requiredGames})} />
          </div>
        )}
      </div>
    );
  }
}

export default Roster;
