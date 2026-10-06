import {t, formatNumber} from '../../i18n/core';
import {h} from 'preact';
import {useRef, useEffect, useState} from 'preact/hooks';
import type {PlayerNetworkData} from '@legion/shared/interfaces';
import {Class, ClassLabels} from '@legion/shared/enums';
import {GAME_0_TURN_DURATION} from '@legion/shared/config';
import ClassCrest from '../HUD/ClassCrest';
import {events} from '../HUD/GameHUD';
import {combatTipsVisible} from '../../game/TutorialManager';
import {getSpritePath, playSoundEffect} from '../utils';
import hourglass from '@assets/HUD/hourglass.png';
import sword from '@assets/stats_icons/attack_icon.png';
import enterSound from '@assets/sfx/equip.wav';
import './TeamReveal.style.css';

interface TeamRevealProps {
  team: PlayerNetworkData[];
  onComplete: () => void;
}

export function TeamReveal({team, onComplete}: TeamRevealProps) {
  const [tips, setTips] = useState(() => combatTipsVisible(true));
  const startButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { startButton.current?.focus(); }, []);
  const start = () => {
    events.emit('combatTipsVisibility', tips);
    playSoundEffect(enterSound);
    onComplete();
  };
  return <section className="team-reveal-overlay" role="dialog" aria-modal="true" aria-labelledby="team-reveal-title">
    <h2 id="team-reveal-title" className="team-reveal-title">{t('Your team')}</h2>
    <div className="team-reveal-stage">
      {team.map((character, index) => <article className="team-reveal-champion" data-class={character.class}
        key={character.id || index} style={{'--arrival': `${index * 90}ms`}}>
        <div className="team-reveal-figure" aria-hidden="true">
          <div className="team-reveal-aura" />
          <div className="team-reveal-sprite" style={{backgroundImage: `url(${getSpritePath(character.portrait)})`}} />
          <div className="team-reveal-plinth" />
        </div>
        <div className="team-reveal-nameplate">
          <span className="team-reveal-crest" aria-hidden="true"><ClassCrest characterClass={character.class} /></span>
          <h3>{character.name}</h3>
          <span className="team-reveal-class">{t(ClassLabels[character.class])}</span>
        </div>
        <p className="team-reveal-role">{t(character.class === Class.WARRIOR ? 'Close combat'
          : character.class === Class.WHITE_MAGE ? 'Healing' : 'Ranged magic')}</p>
      </article>)}
    </div>
    <div className="team-reveal-actions">
      <div className="team-reveal-options">
        <label className="team-reveal-tips">
          <input type="checkbox" data-game-control checked={tips} onChange={event => setTips(event.currentTarget.checked)} />
          <span className="team-reveal-check" aria-hidden="true">{tips ? '✓' : ''}</span>
          <span>{t('Combat tips')}</span>
        </label>
        <span className="team-reveal-time"><img src={hourglass} alt="" />{t('{{seconds}} seconds per turn', {seconds: formatNumber(GAME_0_TURN_DURATION)})}</span>
      </div>
      <button ref={startButton} type="button" data-game-control className="team-reveal-play-button" onClick={start}>
        <img src={sword} alt="" />{t('Start battle')}
      </button>
    </div>
  </section>;
}
