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
  return (
    <aside className="combat-coach" aria-label="Combat help">
      <div className="combat-coach-heading">
        {visible && <span>Training <span className="combat-coach-progress">{message?.learned ?? 0}/3 basics tried</span></span>}
        <button type="button" data-game-control aria-expanded={visible} aria-controls="combat-coach-instruction" onClick={onToggle}>
          {visible ? 'Hide tips' : '? Combat tips'}
        </button>
      </div>
      {visible && message && (
        <div id="combat-coach-instruction" className="combat-coach-instruction" role="status" aria-live="polite" aria-atomic="true">
          <strong>{message.title}</strong>
          <p>{message.content}</p>
        </div>
      )}
      {feedback && <p className="combat-action-feedback" role="status" aria-live="polite">{feedback}</p>}
    </aside>
  );
}
