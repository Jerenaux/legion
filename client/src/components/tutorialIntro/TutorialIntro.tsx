import {h, Fragment} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {t, formatNumber, localizedAsset} from '../../i18n/core';
import {GAME_0_TURN_DURATION} from '@legion/shared/config';
import {DESKTOP_ACTION_EVENT, type DesktopAction} from '../../input/actions';
import turnOrder from '@assets/guide/turn-order.jpg';
import actions from '@assets/guide/actions.jpg';
import movement from '@assets/tutorial/movement.jpg';
import fire from '@assets/tutorial/fire.jpg';
import moveIcon from '@assets/stats_icons/move_range_icon.png';
import attackIcon from '@assets/stats_icons/attack_icon.png';
import spellIcon from '@assets/shop/spells_icon.png';
import itemIcon from '@assets/shop/consumables_icon.png';
import hourglass from '@assets/HUD/hourglass.png';
import './TutorialIntro.css';

export function TutorialIntro({onComplete}: {onComplete: () => void}) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const titles = [t('One action per turn'), t('Move and target'), t('Fire changes the battlefield')];
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    next.current?.focus();
    // Keep keyboard and controller actions inside the modal, out of Phaser and the HUD.
    const keyboard = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); onComplete(); }
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    const controller = (event: CustomEvent<{action: DesktopAction}>) => {
      event.stopImmediatePropagation();
      const {action} = event.detail;
      if (action === 'cancel' || action === 'abandon-dialog') return onComplete();
      const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (['menu-up', 'menu-left', 'previous-unit'].includes(action)) buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
      if (['menu-down', 'menu-right', 'next-unit'].includes(action)) buttons[(index + 1) % buttons.length]?.focus();
      if (action === 'confirm') (document.activeElement as HTMLButtonElement)?.click();
    };
    window.addEventListener('keydown', keyboard, true);
    window.addEventListener(DESKTOP_ACTION_EVENT, controller as EventListener, true);
    return () => {
      window.removeEventListener('keydown', keyboard, true);
      window.removeEventListener(DESKTOP_ACTION_EVENT, controller as EventListener, true);
      element.close();
    };
  }, [onComplete]);

  return <dialog ref={dialog} className="tutorial-intro" aria-modal="true" aria-labelledby="tutorial-intro-title" aria-describedby="tutorial-intro-copy">
    <div className="tutorial-intro-heading">
      <img src={step === 0 ? hourglass : step === 1 ? moveIcon : spellIcon} alt="" />
      <h2 id="tutorial-intro-title">{titles[step]}</h2>
    </div>
    <div className="tutorial-intro-content" key={step}>
      {step === 0 ? <>
        <div className="tutorial-intro-turns">
          <img src={localizedAsset('guide/turn-order.jpg', turnOrder)} alt={t('Turn order')} />
        </div>
        <p id="tutorial-intro-copy">{t('Characters take turns. Choose one action, then the next character acts.')}</p>
        <div className="tutorial-intro-actions">
          {[[moveIcon, t('Move')], [attackIcon, t('Attack')], [spellIcon, t('Spell')], [itemIcon, t('Item')]].map(([icon, label], index) =>
            <div className="tutorial-intro-choice" key={label}>
              {index > 0 && <span className="tutorial-intro-or">{t('or')}</span>}
              <img src={icon} alt="" /><span>{label}</span>
            </div>)}
        </div>
        <div className="tutorial-intro-timer"><img src={hourglass} alt="" />{t('{{seconds}} seconds per turn', {seconds: formatNumber(GAME_0_TURN_DURATION)})}</div>
        <img className="tutorial-intro-dock" src={localizedAsset('guide/actions.jpg', actions)} alt={t('Action bar')} />
      </> : <>
        <div className="tutorial-intro-scene">
          <img src={step === 1 ? movement : fire} alt="" />
        </div>
        <p id="tutorial-intro-copy">{step === 1
          ? t('Select a blue tile to move, or an adjacent enemy to attack. To aim a spell, select its icon in the action bar, then a highlighted tile.')
          : t('Fire hits a tile, even if it is empty, and leaves flames behind. Crossing flames or standing in them causes damage.')}</p>
      </>}
    </div>
    <footer className="tutorial-intro-footer">
      <button type="button" data-game-control data-desktop-cancel className="tutorial-intro-skip" onClick={onComplete}>{t('Skip tutorial')}</button>
      <nav className="tutorial-intro-steps" aria-label={t('Tutorial steps')}>
        {titles.map((title, index) => <button type="button" data-game-control key={title} aria-label={title}
          aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} />)}
      </nav>
      <div className="tutorial-intro-navigation">
        <button type="button" data-game-control className="tutorial-intro-back" disabled={step === 0} onClick={() => setStep(step - 1)}>{t('Back')}</button>
        <button ref={next} type="button" data-game-control className="tutorial-intro-next" onClick={() => step === 2 ? onComplete() : setStep(step + 1)}>
          {step === 2 ? t('Fight') : t('Next')}<span aria-hidden="true">{step === 2 ? '⚔' : '›'}</span>
        </button>
      </div>
    </footer>
  </dialog>;
}
