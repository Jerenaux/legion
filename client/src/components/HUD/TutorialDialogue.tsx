import { h, Component } from 'preact';
import '../../styles/components/TutorialDialogue.css';

interface TutorialDialogueProps {
  message: string;
  isVisible: boolean;
  avatarSrc?: string;
  speakerName?: string;
  onNext?: () => void;
}

interface TutorialDialogueState {
  displayedMessage: string;
  isAvatarLoaded: boolean;
}

class TutorialDialogue extends Component<TutorialDialogueProps, TutorialDialogueState> {
  private typingTimer: number | null = null;
  private typingSpeed: number = 30; // milliseconds per character

  state: TutorialDialogueState = {
    displayedMessage: '',
    isAvatarLoaded: false,
  };

  componentDidMount() {
    if (this.props.isVisible && this.props.message) {
      this.resetTyping();
    }
  }

  componentDidUpdate(prevProps: TutorialDialogueProps) {
    if (this.props.message !== prevProps.message || this.props.isVisible !== prevProps.isVisible) {
      this.resetTyping();
    }
    if (this.props.avatarSrc !== prevProps.avatarSrc) {
      this.setState({ isAvatarLoaded: false });
    }
  }

  componentWillUnmount() {
    this.clearTypingTimer();
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
    const { message } = this.props;
    const { displayedMessage } = this.state;

    if (displayedMessage.length < message.length) {
      this.setState(
        { displayedMessage: message.slice(0, displayedMessage.length + 1) },
        () => {
          this.typingTimer = window.setTimeout(() => this.typeMessage(), this.typingSpeed);
        }
      );
    }
  }

  handleAvatarLoad = () => {
    this.setState({ isAvatarLoaded: true });
  }

  render() {
    const { isVisible, avatarSrc = 'avatars/default.png', speakerName = 'Taskmaster', onNext } = this.props;
    const { displayedMessage, isAvatarLoaded } = this.state;

    if (!isVisible) {
      return null;
    }

    return (
      <div className={`tutorial-dialogue ${isAvatarLoaded ? 'visible' : ''}`}>
        <img 
          src={avatarSrc} 
          alt="Character Avatar" 
          className="tutorial-dialogue-avatar" 
          onLoad={this.handleAvatarLoad}
        />
        <div className="tutorial-dialogue-content">
          <div className="tutorial-dialogue-speaker">{speakerName}</div>
          <p>{displayedMessage}</p>
        </div>
        <button className="tutorial-dialogue-next" onClick={onNext} aria-label="Next">
          <div className="tutorial-dialogue-next-arrow"></div>
        </button>
      </div>
    );
  }
}

export default TutorialDialogue;
