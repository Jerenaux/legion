// The face-off before every match: both commanders slam in from opposite sides, the VS
// strikes between them, then the screen clears for the arena's drop-in. Any click or key skips it.
import {t, formatNumber} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';
import {h} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {Class, LeaguesNames, PlayMode, PlayModeLabels} from '@legion/shared/enums';
import type {CommunitySummary} from '@legion/shared/communities';
import {getLeagueIcon, getSpritePath, loadAvatar} from '../utils';
import ClassCrest from '../HUD/ClassCrest';
import Sigil from '../sigil/Sigil';
import './VersusScreen.css';

export interface VersusSide {
  name: string;
  avatar: string;
  league: number;
  rank: number;
  bot: boolean;
  community: CommunitySummary | null;
  characters: {name: string; portrait: string; class: Class; level: number}[];
}

export interface VersusData {
  mode: PlayMode;
  floor: number | null;
  own: VersusSide;
  enemy: VersusSide;
}

const HOLD_MS = 2700;
const EXIT_MS = 450;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Side({side, position, floor}: {side: VersusSide; position: 'own' | 'enemy'; floor: number | null}) {
  const league = t(LeaguesNames[side.league] ?? LeaguesNames[0]);
  const standing = floor != null ? null : side.rank > 0 ? t('navLeagueRank', {league, rank: formatNumber(side.rank)}) : league;
  return <section className={`versus-side versus-side--${position}`} aria-label={side.name}>
    <div className="versus-side__panel">
      <div className="versus-side__identity">
        <img className="versus-side__avatar" src={loadAvatar(side.avatar || 'default')} alt="" />
        <div className="versus-side__text">
          <strong className="versus-side__name">{side.name}</strong>
          <div className="versus-side__meta">
            {floor == null && <img className="versus-side__league" src={getLeagueIcon(side.league)} alt={league} />}
            {floor != null && position === 'enemy'
              ? <span><Trans i18nKey="Floor <0>{{floor}}</0>" values={{floor}} components={[<strong />]} /></span>
              : standing && <span>{standing}</span>}
            {side.community && <span className="versus-side__community">
              <Sigil sigil={side.community.sigil} size={26} label={side.community.name} />{side.community.tag}
            </span>}
          </div>
        </div>
      </div>
      <ul className="versus-side__team">
        {side.characters.map((character, index) => (
          <li key={index} style={{'--i': index}}>
            <div className="versus-side__sprite" style={{backgroundImage: `url(${getSpritePath(character.portrait)})`}} />
            <span className="versus-side__crest"><ClassCrest characterClass={character.class} /></span>
            <span className="versus-side__character">{character.name}</span>
            {Number.isFinite(character.level) && <span className="versus-side__level">{t("Lvl")} {formatNumber(character.level)}</span>}
          </li>
        ))}
      </ul>
    </div>
  </section>;
}

export default function VersusScreen({data, onComplete}: {data: VersusData; onComplete: () => void}) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const leave = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onComplete, reducedMotion() ? 0 : EXIT_MS);
  };
  useEffect(() => {
    const timer = setTimeout(leave, HOLD_MS);
    const skip = (event: KeyboardEvent) => { if (!event.repeat) leave(); };
    window.addEventListener('keydown', skip);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', skip); };
  }, []);

  return createPortal(
    <div className={`versus${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true"
      aria-label={t("{{value0}} vs {{value1}}", {value0: data.own.name, value1: data.enemy.name})} onClick={leave} onKeyDown={leave}>
      <div className="versus__backdrop" aria-hidden="true" />
      <Side side={data.own} position="own" floor={data.floor} />
      <Side side={data.enemy} position="enemy" floor={data.floor} />
      <div className="versus__seam" aria-hidden="true" />
      <div className="versus__emblem" aria-hidden="true">
        <span className="versus__ring" />
        <span className="versus__burst">{Array.from({length: 14}, (_, i) => <i key={i} style={{'--a': `${i * (360 / 14)}deg`}} />)}</span>
        <strong className="versus__vs">VS</strong>
      </div>
      {data.mode !== PlayMode.TOWER && PlayModeLabels[data.mode] && <p className="versus__mode">{t(PlayModeLabels[data.mode])}</p>}
    </div>,
    document.body,
  );
}
