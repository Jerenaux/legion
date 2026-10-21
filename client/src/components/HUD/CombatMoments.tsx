// Big combat moments drawn over the arena: callouts (last stand, rampage), the last-stand
// vignette and the name card of an X-tier spell.
import {t} from '../../i18n/core';
import {h} from 'preact';
import './CombatMoments.style.css';

export interface Callout {
  kind: 'lastStand' | 'rampage';
  name: string;
  own: boolean;
  /** Changes on every callout so a repeat replays its animation. */
  key: number;
}

export interface SpellCinematic {
  caster: string;
  spell: string;
  element: 'fire' | 'ice' | 'thunder';
  own: boolean;
}

const TITLES = {
  lastStand: () => t("Last stand!"),
  rampage: () => t("Rampage!"),
};

export function CombatCallout({callout}: {callout: Callout}) {
  return <div className={`combat-callout combat-callout--${callout.kind}`} data-side={callout.own ? 'own' : 'enemy'}
    key={callout.key} role="status">
    <div className="combat-callout__band" aria-hidden="true" />
    <strong className="combat-callout__title">{TITLES[callout.kind]()}</strong>
    <span className="combat-callout__name">{callout.name}</span>
  </div>;
}

export function LastStandVignette() {
  return <div className="last-stand-vignette" aria-hidden="true" />;
}

export function SpellNameCard({cinematic}: {cinematic: SpellCinematic}) {
  return <div className={`spell-name-card spell-name-card--${cinematic.element}`} data-side={cinematic.own ? 'own' : 'enemy'}
    role="status" key={`${cinematic.caster}-${cinematic.spell}`}>
    <span className="spell-name-card__caster">{cinematic.caster}</span>
    <strong className="spell-name-card__spell">{t(cinematic.spell)}</strong>
  </div>;
}
