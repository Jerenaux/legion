import {t} from '../../i18n/core';
import { h } from 'preact';
// Button.tsx
import { Component } from 'preact';
import './BottomBorderDivider.style.css';

interface DividerProps {
    label: string;
  }

class BottomBorderDivider extends Component<DividerProps> {

  render() {
    return (
      <div className="dividerContainer">
        <span>{t(this.props.label)}</span>
      </div>
    );
  }
}

export default BottomBorderDivider;