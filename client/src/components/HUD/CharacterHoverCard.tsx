import { h } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { ClassLabels } from '@legion/shared/enums';
import { TeamMember } from '@legion/shared/interfaces';
import ClassCrest from './ClassCrest';
import { statusIcons } from '../utils';
import './CharacterHoverCard.style.css';

export interface CharacterHover {
  team: number;
  num: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type InspectCharacter = (team: number, num: number, element: HTMLElement | null) => void;

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
        <div><strong>{character.name}</strong><span>{ClassLabels[character.class]}</span></div>
      </header>
      {[
        { label: 'HP', value: character.hp, max: character.maxHP },
        { label: 'MP', value: character.mp, max: character.maxMP },
      ].map(({ label, value, max }) => (
        <div key={label} className="character-hover-card__resource" data-resource={label}>
          <div><span>{label}</span><b>{Number.isFinite(value) && Number.isFinite(max) ? `${Math.round(value)} / ${Math.round(max)}` : 'Unknown'}</b></div>
          <div className="character-hover-card__track">
            <div style={{ width: `${max > 0 && Number.isFinite(value) ? Math.min(100, Math.max(0, value / max * 100)) : 0}%` }} />
          </div>
        </div>
      ))}
      <div className="character-hover-card__statuses">
        {activeStatuses.length ? activeStatuses.map(([status, turns]) => (
          <span key={status}><img src={statusIcons[status]} alt="" />{status}<b>{turns === -1 ? '∞' : turns}</b></span>
        )) : <span className="character-hover-card__no-status">No status effects</span>}
      </div>
    </div>
  );
}
