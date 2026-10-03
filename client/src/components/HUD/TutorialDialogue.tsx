import { t } from '../../i18n/core';
import { h } from 'preact';
import type { TutorialMessage } from '../../game/TutorialManager';
import '../../styles/components/TutorialDialogue.css';

interface TutorialDialogueProps {
  message?: TutorialMessage;
  visible: boolean;
  onToggle: () => void;
  feedback?: string;
}

export default function TutorialDialogue({ message, visible, onToggle, feedback }: TutorialDialogueProps) {
  // Leave the battlefield quiet while the opponent acts, without changing the player's preference.
  if (!message && !feedback) return null;
  return (
    <aside className="combat-coach" aria-label={t("Combat help")} data-learned={message?.learned}>
      {message && (visible ? (
        <div className="combat-coach-panel">
          <div className="combat-coach-heading">
            <span>{t("Combat tips")}</span>
            <button type="button" data-game-control aria-label={t("Hide combat tips")} aria-expanded="true"
              aria-controls="combat-coach-instruction" onClick={onToggle}>×</button>
          </div>
          <div id="combat-coach-instruction" className="combat-coach-instruction" role="status" aria-live="polite" aria-atomic="true">
            <strong>{message.title}</strong>
            <p>{message.content}</p>
          </div>
        </div>
      ) : (
        <button type="button" data-game-control className="combat-coach-reopen" aria-expanded="false"
          aria-controls="combat-coach-instruction" onClick={onToggle}>? <span>{t("Combat tips")}</span></button>
      ))}
      {feedback && <p className="combat-action-feedback" role="status" aria-live="polite">{feedback}</p>}
    </aside>
  );
}
