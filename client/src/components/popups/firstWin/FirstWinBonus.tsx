import {h} from 'preact';
import {useContext, useEffect, useRef, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {PlayerContext} from '../../../contexts/PlayerContext';
import {apiMutation} from '../../../services/apiService';
import {language, t, userError} from '../../../i18n/core';
import {playSoundEffect, silentErrorToast} from '../../utils';
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
  const {refreshPlayerData} = useContext(PlayerContext);
  const [shown, setShown] = useState(reducedMotion() ? gold : 0);
  const [state, setState] = useState<'ready' | 'claiming' | 'claimed'>('ready');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

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

  const claim = async () => {
    if (state !== 'ready') return;
    setState('claiming');
    try {
      await apiMutation('claimFirstWinBonus', {});
      if (!mounted.current) return;
      playSoundEffect(rewardSound, sfxLevel('purchase'));
      setShown(gold);
      setState('claimed');
      refreshPlayerData();
      // Let the coins fly toward the gold counter; any click or key skips it.
      setTimeout(() => mounted.current && onClose(), reducedMotion() ? 0 : 750);
    } catch (error) {
      if (!mounted.current) return;
      silentErrorToast(userError(error));
      setState('ready');
    }
  };

  return <Modal isOpen onRequestClose={state === 'claimed' ? onClose : claim} contentLabel={t('First win of the day')}
    className={`first-win first-win--${state}`} overlayClassName="first-win-overlay" shouldCloseOnOverlayClick={state === 'claimed'}>
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
      disabled={state === 'claiming'} onClick={state === 'claimed' ? onClose : claim}>
      {state === 'claimed' ? t('Continue') : t('Claim {{value0}} gold', {value0: gold})}
    </button>
  </Modal>;
}
