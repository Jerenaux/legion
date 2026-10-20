import {t} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import cdIcon from '@assets/inventory/cd_icon.png';

interface CircularTimerProps {
  turnDuration: number;  // Total turn duration in seconds
  timeLeft: number;    // Time remaining in seconds
  turnNumber: number;
  size?: number;
  strokeWidth?: number;
}

interface CircularTimerState {
  progress: number;
  urgency: '' | 'warning' | 'danger';
}

/** Ember when time runs short, red and pulsing at the end; scaled down for short turns. */
function urgency(remaining: number, duration: number): CircularTimerState['urgency'] {
  if (remaining <= 0) return '';
  if (remaining <= Math.min(5, duration * 0.25)) return 'danger';
  if (remaining <= Math.min(10, duration * 0.45)) return 'warning';
  return '';
}

export class CircularTimer extends Component<CircularTimerProps, CircularTimerState> {
  private animationFrame: number;
  private startTime: number;

  state: CircularTimerState = {
    progress: 100,
    urgency: '',
  };

  componentDidMount() {
    this.startTimer();
  }

  componentDidUpdate(prevProps: CircularTimerProps) {
    if (prevProps.turnNumber !== this.props.turnNumber || prevProps.timeLeft !== this.props.timeLeft || prevProps.turnDuration !== this.props.turnDuration) {
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
    const initialProgress = this.props.turnDuration > 0 ? (this.props.timeLeft / this.props.turnDuration) * 100 : 0;
    this.setState({ progress: initialProgress });
    this.animate();
  }

  animate = () => {
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const remainingTime = Math.max(0, this.props.timeLeft - elapsed / 1000);
    const progress = this.props.turnDuration > 0 ? (remainingTime / this.props.turnDuration) * 100 : 0;

    this.setState({ progress, urgency: urgency(remainingTime, this.props.turnDuration) });

    if (progress > 0) {
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  };

  render() {
    const { size = 40, strokeWidth = 4 } = this.props;
    if (this.props.turnDuration === 0) return null;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (this.state.progress / 100) * circumference;

    return (
      <div class="circular_timer" data-urgency={this.state.urgency || undefined}>
        <svg width={size} height={size}>
          <title>{t("Turn time remaining")}</title>
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
        <img src={cdIcon} class="circular_timer_icon" alt={t("CD Icon")} />
      </div>
    );
  }
}
