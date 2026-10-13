import {t, i18n, formatNumber} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';

import { h } from 'preact';
// PurchaseDialog.tsx
import './PurchaseDialog.style.css';
import Spinner from '../spinner/Spinner';
import Modal from 'react-modal';
import { Component } from 'preact';
import { mapFrameToCoordinates, getSpritePath } from '../utils';
import { modalData } from '../shopContent/ShopContent';
import { PlayerContext } from '../../contexts/PlayerContext';

// Import image assets
import goldIcon from '@assets/gold_icon.png';
import confirmIcon from '@assets/inventory/confirm_icon.png';
import cancelIcon from '@assets/inventory/cancel_icon.png';

Modal.setAppElement('#root');

interface PurchaseDialogProps {
  dialogOpen: boolean;
  pending?: boolean;
  dialogData: modalData,
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  purchase: (id: string | number, quantity: number, price: number) => void;
}

interface PurchaseDialogState {
  count: number;
}

class PurchaseDialog extends Component<PurchaseDialogProps, PurchaseDialogState> {
  static contextType = PlayerContext;

  state: PurchaseDialogState = {
    count: 1
  }

  handleCount = (increase: boolean) => {
    if (!increase && this.state.count === 1) return;
    this.setState(prev => ({count: increase ? prev.count + 1 : prev.count - 1}));
  }

  handleCloseDialog = () => {
    if (this.props.pending) return;
    this.setState({count: 1}); // initialize count
    this.props.handleClose();
  }

  render() {
    const { dialogData, position, dialogOpen } = this.props;

    if (!dialogData) {
      return null;
    }

    const hasEnoughGold = this.state.count * dialogData.price <= this.context.player.gold;

    const customStyles = {
      content: {
        top: position.top,
        left: position.left,
        right: 'auto',
        bottom: 'auto',
        padding: 0,
        border: 'none',
        background: 'transparent',
        overflow: 'visible'
      },
      overlay: {
        zIndex: 10,
        backgroundColor: 'transparent',
      }
    };

    const coordinates = mapFrameToCoordinates(dialogData.frame);
    const total = dialogData.price * this.state.count;

    return (
      <Modal isOpen={dialogOpen} style={customStyles} onRequestClose={this.handleCloseDialog}>
        <div className={`buy-dialog${dialogData.isCharacter ? ' is-character' : ''}`} role="dialog" aria-label={dialogData.isCharacter ? dialogData.name : t(dialogData.name)}>
          <p className="buy-dialog-title">{dialogData.isCharacter ? dialogData.name : t(dialogData.name)}</p>

          <div className="buy-dialog-stand">
            {dialogData.isCharacter
              ? <span className="buy-dialog-character" style={{backgroundImage: `url(${getSpritePath(dialogData.url)})`}} />
              : <span className="buy-dialog-item" style={{backgroundImage: `url(${dialogData.url})`, '--fx': coordinates.x / 32, '--fy': coordinates.y / 32}} />}
          </div>

          {!dialogData.isCharacter && (
            <div className="buy-dialog-count">
              <button type="button" data-game-control className="buy-dialog-step" aria-label="-" disabled={this.props.pending || this.state.count === 1} onClick={() => this.handleCount(false)}>−</button>
              <output className="buy-dialog-quantity">{this.state.count}</output>
              <button type="button" data-game-control className="buy-dialog-step" aria-label="+" disabled={this.props.pending} onClick={() => this.handleCount(true)}>+</button>
            </div>
          )}

          <div className={`buy-dialog-price${hasEnoughGold ? '' : ' is-unaffordable'}`} title={hasEnoughGold ? undefined : t('Not enough gold')}>
            <img src={goldIcon} alt={t("cost")} />
            <span>{formatNumber(total)}</span>
          </div>

          <div className="buy-dialog-buttons">
            <button type="button" data-game-control
              className="buy-dialog-accept"
              onClick={() => this.props.purchase(dialogData.id, this.state.count, dialogData.price)}
              disabled={this.props.pending || !hasEnoughGold} aria-busy={this.props.pending}
            >{this.props.pending && <Spinner />}<Trans i18n={i18n} i18nKey={"<0/>Buy"} components={[<img src={confirmIcon} alt="" />]} /></button>
            <button type="button" data-game-control className="buy-dialog-cancel" disabled={this.props.pending} onClick={this.handleCloseDialog}><Trans i18n={i18n} i18nKey={"<0/>Cancel"} components={[<img src={cancelIcon} alt="" />]} /></button>
          </div>
        </div>
      </Modal>
    );
  }
}

export default PurchaseDialog;