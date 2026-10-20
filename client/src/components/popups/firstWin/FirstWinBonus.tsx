import {h} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {PlayerContext} from '../../../contexts/PlayerContext';
import {apiMutation} from '../../../services/apiService';
import {language, t} from '../../../i18n/core';
import {playSoundEffect} from '../../utils';
import {predictFirstWinClaim} from '../../../providers/predictions';
import {sfxLevel} from '../../../sfxMix';
import goldIcon from '@assets/gold_icon.png';
import shine from '@assets/game_end/shine_bg.png';
import rewardSound from '@assets/sfx/purchase.wav';
import './FirstWinBonus.css';

const COINS = 12;
// Keyboard and controller focus start on the claim button.
const focusOnMount = (button: HTMLButtonElement | null) => button?.focus({preventScroll: true});
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Next reset of the daily bonus (UTC midnight), in the player's own clock. */
function resetTime() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return new Intl.DateTimeFormat(language, {hour: 'numeric', minute: '2-digit'}).format(midnight);
}

export default function FirstWinBonus({gold, onClose}: {gold: number; onClose: () => void}) {
  const {optimisticMutation} = useContext(PlayerContext);
  const [shown, setShown] = useState(reducedMotion() ? gold : 0);

  // Count the bonus up while the coins land.
  useEffect(() => {
    if (shown >= gold) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start - 250) / 700);
      setShown(Math.round(gold * Math.max(0, 1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [gold]);

  // Credit the gold and close at once; the server confirms in the background and a failure rolls back.
  const claim = () => {
    if (!optimisticMutation(predictFirstWinClaim, () => apiMutation('claimFirstWinBonus', {}))) return;
    playSoundEffect(rewardSound, sfxLevel('purchase'));
    onClose();
  };

  return <Modal isOpen onRequestClose={claim} contentLabel={t('First win of the day')}
    className="first-win" overlayClassName="first-win-overlay" shouldCloseOnOverlayClick={false}>
    <div className="first-win-emblem" aria-hidden="true">
      <img className="first-win-rays" src={shine} alt="" />
      <img className="first-win-pile" src={goldIcon} alt="" />
      {Array.from({length: COINS}, (_, index) => <img key={index} className="first-win-coin" src={goldIcon} alt=""
        style={{'--coin-angle': `${(index / COINS) * 360 + (index % 3) * 9}deg`, '--coin-order': index}} />)}
    </div>
    <h2>{t('First win of the day')}</h2>
    <p className="first-win-amount" aria-live="polite"><img src={goldIcon} alt="" />+{new Intl.NumberFormat(language).format(shown)}</p>
    <p className="first-win-rule">{t('Your first Casual or Ranked win each day earns this bonus. It resets at {{value0}}.', {value0: resetTime()})}</p>
    <button type="button" className="game-btn game-btn--gold first-win-claim" ref={focusOnMount} data-desktop-cancel
      onClick={claim}>
      {t('Claim {{value0}} gold', {value0: gold})}
    </button>
  </Modal>;
}
