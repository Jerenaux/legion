import {t, formatNumber} from '../../i18n/core';
import { h } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { ClassLabels } from '@legion/shared/enums';
import { TeamMember } from '@legion/shared/interfaces';
import ClassCrest from './ClassCrest';
import { statusIcons, statusPulse } from '../utils';
import './CharacterHoverCard.style.css';

export interface CharacterHover {
  preview?: {hp: number; action: string};
  team: number;
  num: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type InspectCharacter = (team: number, num: number, element: HTMLElement | null) => void;

/** A finishing blow: shown when the hovered action would knock the character out. */
function SkullIcon() {
  return <svg className="skull-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" d="M12 2C6.9 2 3 5.7 3 10.4c0 2.8 1.3 5 3.5 6.3V20c0 1.1.9 2 2 2h7c1.1 0 2-.9 2-2v-3.3c2.2-1.3 3.5-3.5 3.5-6.3C21 5.7 17.1 2 12 2zm-3.5 12a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6zm3.5 2.5-1.2-2h2.4l-1.2 2zm3.5-2.5a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6zM10 18h1v2.5h-1V18zm3 0h1v2.5h-1V18z" />
  </svg>;
}

export default function CharacterHoverCard({ character, hover }: { character: TeamMember; hover: CharacterHover }) {
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const element = card.current;
      const { width, height } = element.getBoundingClientRect();
      const x = hover.right + 16 + width <= innerWidth - 12 ? hover.right + 16 : hover.left - width - 16;
      element.style.left = `${Math.max(12, Math.min(x, innerWidth - width - 12))}px`;
      element.style.top = `${Math.max(12, Math.min(hover.top, innerHeight - height - 12))}px`;
      element.style.visibility = 'visible';
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });

  const activeStatuses = Object.entries(character.statuses ?? {}).filter(([, turns]) => turns !== 0);
  return (
    <div ref={card} id="character-hover-card" className="character-hover-card" role="tooltip">
      <header>
        <div className="character-hover-card__crest"><ClassCrest characterClass={character.class} /></div>
        <div><strong>{character.name}</strong><span>{t(ClassLabels[character.class])}</span></div>
      </header>
      {[
        { label: 'HP', value: character.hp, max: character.maxHP },
        { label: 'MP', value: character.mp, max: character.maxMP },
      ].map(({ label, value, max }) => (
        <div key={label} className="character-hover-card__resource" data-resource={label}>
          <div><span>{t(label)}</span><b>{Number.isFinite(value) && Number.isFinite(max) ? `${formatNumber(Math.round(value))} / ${formatNumber(Math.round(max))}` : t("Unknown")}</b></div>
          <div className="character-hover-card__track">
            <div style={{ width: `${max > 0 && Number.isFinite(value) ? Math.min(100, Math.max(0, value / max * 100)) : 0}%` }} />
          </div>
        </div>
      ))}
      {hover.preview && <div className="character-hover-card__preview" data-heal={hover.preview.hp > 0}
        data-lethal={hover.preview.hp < 0 && character.hp + hover.preview.hp <= 0}>
        <span>{t(hover.preview.action)}</span>
        {hover.preview.hp < 0 && character.hp + hover.preview.hp <= 0
          ? <b className="character-hover-card__ko"><SkullIcon />{t("KO")}</b>
          : <b>{t("HP")} {formatNumber(hover.preview.hp, {signDisplay: 'always'})}</b>}
      </div>}
      <div className="character-hover-card__statuses">
        {activeStatuses.length ? activeStatuses.map(([status, turns]) => (
          <span {...statusPulse(character.statusRefreshes, status)}><img src={statusIcons[status]} alt={""} />{t(status)}<span className="character-hover-card__sep" aria-hidden="true">·</span><b>{turns === -1 ? '∞' : t('statusDuration', {count: turns})}</b></span>
        )) : <span className="character-hover-card__no-status">{t("No status effects")}</span>}
      </div>
    </div>
  );
}
