import {t} from '../../i18n/core';
import {h} from 'preact';
import type {TutorialMessage} from '../../game/TutorialManager';
import moveIcon from '@assets/stats_icons/move_range_icon.png';
import attackIcon from '@assets/stats_icons/attack_icon.png';
import spellIcon from '@assets/shop/spells_icon.png';
import itemIcon from '@assets/shop/consumables_icon.png';
import turnIcon from '@assets/HUD/hourglass.png';
import '../../styles/components/TutorialDialogue.css';

const icons = {move: moveIcon, attack: attackIcon, spell: spellIcon, item: itemIcon, turn: turnIcon};
interface TutorialDialogueProps {
  message?: TutorialMessage;
  visible: boolean;
  onToggle: () => void;
  feedback?: string;
}

export default function TutorialDialogue({message, visible, onToggle, feedback}: TutorialDialogueProps) {
  if (!message && !feedback) return null;
  return <aside className="combat-coach" aria-label={t('Combat help')} data-learned={message?.learned}>
    {message && (visible ? <div className="combat-coach-panel">
      <span className="combat-coach-icon" aria-hidden="true">{message.icon ? <img src={icons[message.icon]} alt="" /> : '!'}</span>
      <div id="combat-coach-instruction" className="combat-coach-instruction" role="status" aria-live="polite" aria-atomic="true">
        <strong>{message.title}</strong>
        <p>{message.content}</p>

      </div>
      <button type="button" data-game-control className="combat-coach-close" aria-label={t('Hide combat tips')}
        aria-expanded="true" aria-controls="combat-coach-instruction" onClick={onToggle}>×</button>
    </div> : <button type="button" data-game-control className="combat-coach-reopen" aria-expanded="false"
      onClick={onToggle}><span aria-hidden="true">?</span> {t('Combat tips')}</button>)}
    {feedback && <p className="combat-action-feedback" role="status" aria-live="polite">{feedback}</p>}
  </aside>;
}
