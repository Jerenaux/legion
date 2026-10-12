import {t} from '../../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import goldChestImage from '@assets/shop/gold_chest.png';
import './SimplePopup.style.css';

interface Props {
  text: string;
  header?: string;
  /** Dismisses the tip; it is then remembered as seen. */
  onHide?: () => void;
}

export class SimplePopup extends Component<Props> {
  render() {
    const { header, text, onHide } = this.props;
    return (
      <div className="simple-popup">
        {onHide && <button type="button" data-game-control className="simple-popup-close" onClick={onHide} aria-label={t("Close notification")}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>}
        <div className="simple-popup-content">
          <img
            src={goldChestImage}
            alt={t("Gold chest")}
            className="simple-popup-icon"
          />
          <div className="simple-popup-text-container">
            {header && <h3 className="simple-popup-header">{header}</h3>}
            <p className="simple-popup-text"
               dangerouslySetInnerHTML={{ __html: text }}
            />
          </div>
        </div>
      </div>
    );
  }
}