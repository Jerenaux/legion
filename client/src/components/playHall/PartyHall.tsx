// The Play screen's centrepiece: the party gathered in the hall around its hearth.
// Each character opens its Team page; an empty place shows who can still join.
import {h, Fragment} from 'preact';
import {useContext} from 'preact/hooks';
import {Link, route} from 'preact-router';
import {t, i18n, formatNumber} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';
import {Class, LockedFeatures} from '@legion/shared/enums';
import type {APICharacterData} from '@legion/shared/interfaces';
import {LOCKED_FEATURES, MAX_CHARACTERS} from '@legion/shared/config';
import {PlayerContext} from '../../contexts/PlayerContext';
import ClassCrest from '../HUD/ClassCrest';
import DailyLoot from '../dailyLoot/DailyLoot';
import Ghost from '../ghost/Ghost';
import {getSpritePath, classEnumToString} from '../utils';
import lockIcon from '@assets/lock.png';
import './PlayHall.css';

export default function PartyHall() {
  const context = useContext(PlayerContext);
  const characters = context.characters as APICharacterData[];
  const remainingSlots = Math.max(0, MAX_CHARACTERS - characters.length);
  const canRecruit = context.canAccessFeature(LockedFeatures.CHARACTER_PURCHASES);
  const requiredGames = LOCKED_FEATURES[LockedFeatures.CHARACTER_PURCHASES];
  const completedGames = Math.min(requiredGames, context.getCompletedGames());
  const gamesLeft = context.getGamesUntilFeature(LockedFeatures.CHARACTER_PURCHASES);
  // The hearth stands in the middle of the party; everyone before it stands on its left.
  const hearthIndex = Math.ceil((characters.length + (remainingSlots > 0 ? 1 : 0)) / 2);

  const recruit = <>
    <span className="party-member-sprite party-member-sprite--empty" aria-hidden="true" style={{backgroundImage: `url(${getSpritePath('1_1')})`}} />
    <span className="party-member-plate">
      <span className="party-member-name">{canRecruit ? t("Recruit character") : t("Next recruit")}</span>
      {!canRecruit && context.player.isLoaded && <span className="party-recruit-progress">
        <img src={lockIcon} alt="" />
        <span><Trans i18n={i18n} i18nKey="recruitmentUnlock" count={gamesLeft} components={[<strong />]} /></span>
        <progress value={completedGames} max={requiredGames}
          aria-label={t("{{value0}} of {{value1}} games completed. Wins and losses both count.", {value0: completedGames, value1: requiredGames})} />
      </span>}
    </span>
  </>;

  const hearth = <li key="hearth" className="party-hall-hearth" aria-hidden="true"><span className="party-hall-fire" /></li>;

  return (
    <section className="party-hall" aria-label={t("Team")}>
      {characters.length > 0 ? (
        <ul className="party-hall-members">
          {characters.map((character, index) => [
            // The party gathers on both sides of the hearth.
            index === hearthIndex && hearth,
            <li key={character.id}>
              <button type="button" data-game-control className={`party-member${index < hearthIndex ? ' faces-right' : ''}`} data-class={Class[character.class]}
                data-character-id={character.id} onClick={() => route(`/team/${character.id}`)}>
                <span className="party-member-sprite" aria-hidden="true" style={{backgroundImage: `url(${getSpritePath(character.portrait)})`}} />
                {character.sp > 0 && <span className="party-member-sp" title={t("Spend stat points")}>+{formatNumber(character.sp)} {t("SP")}</span>}
                <span className="party-member-plate">
                  <span className="party-member-title">
                    <ClassCrest characterClass={character.class} />
                    <span className="party-member-name" title={character.name}>{character.name}</span>
                  </span>
                  <span className="party-member-meta">
                    <span>{classEnumToString(character.class)}</span>
                    <span className="party-member-level">{t("Lvl")} <strong>{formatNumber(character.level)}</strong></span>
                  </span>
                </span>
              </button>
            </li>,
          ])}
          {characters.length + (remainingSlots > 0 ? 1 : 0) === 1 && hearth}
          {remainingSlots > 0 && <li>
            {canRecruit
              ? <Link href="/shop/characters" className="party-member party-member--recruit" data-game-control>{recruit}</Link>
              : <div className="party-member party-member--recruit is-locked">{recruit}</div>}
          </li>}
        </ul>
      ) : <Ghost height={150} count={3} className="ghost-row" width="10rem" />}
      {context.canAccessFeature(LockedFeatures.DAILY_LOOT) && <DailyLoot data={context.player.dailyloot} scene />}
    </section>
  );
}
