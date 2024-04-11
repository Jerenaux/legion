// ItemDialog.tsx
import './PurchaseDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';

Modal.setAppElement('#root');
interface PurchaseDialogProps {
  dialogOpen: boolean;
  dialogData: {
    name: string;
    url: string;
    price: number;
  };
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
}

interface PurchaseDialogState {
  count: number;
}

class PurchaseDialog extends Component<PurchaseDialogProps, PurchaseDialogState> {
  state: PurchaseDialogState = {
    count: 1
  }

  handleCount = (increase: boolean) => {
    if (!increase && this.state.count == 1) return;
    this.setState(prev => ({count: increase ? prev.count + 1 : prev.count - 1}));
  }

  render() {
    const { dialogData, position, dialogOpen, handleClose } = this.props;

    if (!dialogData) {
      return null;
    }

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

    const spriteStyle = dialogData.url.includes('sprites') ? {
      backgroundImage: `url(${dialogData.url})`,
      width: '68px',
      minHeight: '98px',
      backgroundPosition: '-40px -40px',
      backgroundRepeat: 'no-repeat',
      animation: 'animate-sprite 0.7s steps(1) infinite',
      transform: 'scale(.75)',
    } : {
      backgroundImage: `url(${dialogData.url})`,
      backgroundSize: '100% 100%',
    };

    return (
      <Modal isOpen={dialogOpen} style={customStyles} onRequestClose={handleClose}>
        <div className="purchase-dialog-container">
          <div className="purchase-dialog-title">
            <span>{dialogData.name}</span>
          </div>

          <div className="purchase-dialog-frame" style={spriteStyle}></div>

          <div className="purchase-count-container">
            <div className="purchase-count-button" onClick={() => this.handleCount(false)}><span>-</span></div>
            <div className="purchase-count">
              <span>{this.state.count > 9 ? this.state.count : `0${this.state.count}`}</span>
            </div>
            <div className="purchase-count-button" onClick={() => this.handleCount(true)}><span>+</span></div>
          </div>

          <div className="purchase-dialog-price">
            <img src="/gold_icon.png" alt="cost" />
            <span>{dialogData.price}</span>
          </div>

          <div className="purchase-dialog-button-container">
            <button className="purchase-dialog-accept" onClick={() => { }}><img src="/inventory/confirm_icon.png" alt="confirm" />Buy</button>
            <button className="purchase-dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
          </div>
        </div>
      </Modal>
    );
  }
}

export default PurchaseDialog;