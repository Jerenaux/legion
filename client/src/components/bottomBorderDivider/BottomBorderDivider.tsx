// Button.tsx
import { h, Component } from 'preact';
import './BottomBorderDivider.style.css';

interface DividerProps {
    label: string;
  }

class BottomBorderDivider extends Component<DividerProps> {

  render() {
    return (
      <div className="dividerContainer">
        <span>{this.props.label}</span>
      </div>
    );
  }
}

export default BottomBorderDivider;