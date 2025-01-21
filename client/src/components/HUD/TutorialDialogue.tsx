import { h, Component } from 'preact';
import { events } from './GameHUD';
import '../../styles/components/TutorialDialogue.css';

import avatarSrc from '@assets/avatars/default.png';
import { InventoryType } from '@legion/shared/enums';
const DEFAULT_SPEAKER_NAME = 'Taskmaster';

interface TutorialDialogueProps {
  messages: string[];
  position?: 'bottom' | 'spells' | 'items';
}

interface TutorialDialogueState {
  messageIndex: number;
  displayedMessage: string;
  isAvatarLoaded: boolean;
  dialoguePosition: { top?: number; left?: number } | null;
}

class TutorialDialogue extends Component<TutorialDialogueProps, TutorialDialogueState> {
  private typingTimer: number | null = null;
  private typingSpeed: number = 30; // milliseconds per character

  state: TutorialDialogueState = {
    messageIndex: 0,
    displayedMessage: '',
    isAvatarLoaded: false,
    dialoguePosition: null
  };

  componentDidMount() {
    if (this.props.messages) {
      this.resetTyping();
    }
    if (this.props.position === 'spells' || this.props.position === 'items') {
      this.updateDialoguePosition(this.props.position);
      window.addEventListener('resize', this.updateDialoguePosition.bind(this, this.props.position));
    }
  }

  componentDidUpdate(prevProps: TutorialDialogueProps, prevState: TutorialDialogueState) {
    if (this.props.messages !== prevProps.messages) {
      this.setState({ messageIndex: 0 });
    }
    if (this.props.messages !== prevProps.messages || this.state.messageIndex !== prevState.messageIndex) {
      this.resetTyping();
    }
  }

  componentWillUnmount() {
    this.clearTypingTimer();
    window.removeEventListener('resize', this.updateDialoguePosition.bind(this, this.props.position));
  }

  resetTyping() {
    this.clearTypingTimer();
    this.setState({ displayedMessage: '' }, () => {
      this.typeMessage();
    });
  }

  clearTypingTimer() {
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  typeMessage() {
    const { messages } = this.props;
    const { displayedMessage } = this.state;

    if (displayedMessage.length < messages[this.state.messageIndex].length) {
      this.setState(
        { displayedMessage: messages[this.state.messageIndex].slice(0, displayedMessage.length + 1) },
        () => {
          this.typingTimer = window.setTimeout(() => this.typeMessage(), this.typingSpeed);
        }
      );
    }
  }

  handleAvatarLoad = () => {
    this.setState({ isAvatarLoaded: true });
  }

  handleNext = () => {
    events.emit('nextTutorialMessage');
    // If we're switching to the last message, emit a corresponding event
    if (this.state.messageIndex === this.props.messages.length - 2) {
      events.emit('lastTutorialMessage');
    }
    this.setState(
      { messageIndex: this.state.messageIndex + 1 },
      () => {
        this.resetTyping();
      }
    );
  }

  updateDialoguePosition = (position: 'spells' | 'items') => {
    const anchor = position === 'spells' ? InventoryType.SPELLS : InventoryType.CONSUMABLES;
    const firstIcon = document.querySelector(`#player_hud_${anchor}`);
    if (firstIcon) {
      const rect = firstIcon.getBoundingClientRect();
      this.setState({
        dialoguePosition: {
          top: rect.bottom - 120, 
          left: rect.right + 10,
        }
      });
    }
  };

  render() {
    const { displayedMessage, isAvatarLoaded, messageIndex, dialoguePosition } = this.state;
    const { messages, position = 'bottom' } = this.props;

    if (displayedMessage.length === 0) return null;

    const style = (position === 'spells' || position === 'items') && dialoguePosition
      ? dialoguePosition
      : undefined;

    return (
      <div 
        className={`tutorial-dialogue ${position} visible`}
        style={style}
      >
        {/* <img 
          src={avatarSrc} 
          alt="Character Avatar" 
          className="tutorial-dialogue-avatar" 
          onLoad={this.handleAvatarLoad}
        /> */}
        <div className="tutorial-dialogue-content">
          {/* <div className="tutorial-dialogue-speaker">{DEFAULT_SPEAKER_NAME}</div> */}
          <p className="tutorial-dialogue-message">{displayedMessage}</p>
        </div>
        {messageIndex < messages.length - 1 && (
          <button className="tutorial-dialogue-next" onClick={this.handleNext}>
            <span className="tutorial-dialogue-next-text">Next</span>
            <span className="tutorial-dialogue-next-arrow"></span>
          </button>
        )}
      </div>
    );
  }
}

export default TutorialDialogue;
