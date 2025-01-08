import { h, Component } from 'preact';
import cdIcon from '@assets/inventory/cd_icon.png';

interface CircularTimerProps {
  turnLength: number;  // Total turn duration in seconds
  timeLeft: number;    // Time remaining in seconds
  turnNumber: number;
  size?: number;
  strokeWidth?: number;
}

interface CircularTimerState {
  progress: number;
}

export class CircularTimer extends Component<CircularTimerProps, CircularTimerState> {
  private animationFrame: number;
  private startTime: number;

  state = {
    progress: 100
  };

  componentDidMount() {
    this.startTimer();
  }

  componentDidUpdate(prevProps: CircularTimerProps) {
    if (prevProps.turnNumber !== this.props.turnNumber) {
      this.startTimer();
    }
  }

  componentWillUnmount() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  startTimer = () => {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Always start with fresh values from props
    this.startTime = performance.now();
    const initialProgress = (this.props.timeLeft / this.props.turnLength) * 100;
    this.setState({ progress: initialProgress });
    this.animate();
  }

  animate = () => {
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const remainingTime = Math.max(0, this.props.timeLeft - elapsed / 1000);
    const progress = (remainingTime / this.props.turnLength) * 100;

    this.setState({ progress });

    if (progress > 0) {
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  };

  render() {
    const { size = 40, strokeWidth = 4 } = this.props;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (this.state.progress / 100) * circumference;

    return (
      <div class="circular_timer">
        <svg width={size} height={size}>
          <circle
            class="circular_timer_bg"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke-width={strokeWidth}
          />
          <circle
            class="circular_timer_progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke-width={strokeWidth}
            stroke-dasharray={circumference}
            stroke-dashoffset={offset}
            transform={`rotate(180 ${size / 2} ${size / 2})`}
          />
        </svg>
        <img src={cdIcon} class="circular_timer_icon" alt="CD Icon" />
      </div>
    );
  }
} 