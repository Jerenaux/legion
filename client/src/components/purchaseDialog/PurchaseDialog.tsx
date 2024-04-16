// ItemDialog.tsx
import './PurchaseDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';

Modal.setAppElement('#root');
interface PurchaseDialogProps {
  gold: number;
  dialogOpen: boolean;
  dialogData: {
    id: string | number;
    name: string;
    url: string;
    price: number;
  };
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  purchase: (id: string | number, quantity: number) => void;
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

  handleCloseDialog = () => {
    this.setState({count: 1}); // initialize count
    this.props.handleClose();
  }

  render() {
    const { dialogData, position, dialogOpen } = this.props;

    if (!dialogData) {
      return null;
    }

    const hasEnoughGold = this.state.count * dialogData.price <= this.props.gold;
    const isCharacter = dialogData.url.includes('sprites');

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

    const spriteStyle = isCharacter ? {
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

    const countStyle = !hasEnoughGold ? {
      color: '#f73b00',
    } : {};

    const countContainerStyle = isCharacter ? {
      pointerEvents: 'none',
      cursor: 'not-allowed',
      opacity: 0.5
    } : {};

    const buyBtnStyle = !hasEnoughGold ? {
      opacity: 0.5,
      border: '1px solid #71deff',
      cursor: 'not-allowed'
    } : {};

    return (
      <Modal isOpen={dialogOpen} style={customStyles} onRequestClose={this.handleCloseDialog}>
        <div className="purchase-dialog-container">
          <div className="purchase-dialog-title">
            <span>{dialogData.name}</span>
          </div>

          <div className="purchase-dialog-frame" style={spriteStyle}></div>

          <div className="purchase-count-container" style={countContainerStyle}>
            <div className="purchase-count-button" onClick={() => this.handleCount(false)}><span>-</span></div>
            <div className="purchase-count">
              <span>{this.state.count > 9 ? this.state.count : `0${this.state.count}`}</span>
            </div>
            <div className="purchase-count-button" onClick={() => this.handleCount(true)}><span>+</span></div>
          </div>

          <div className="purchase-dialog-price">
            <img src="/gold_icon.png" alt="cost" />
            <span style={countStyle}>{dialogData.price * this.state.count}</span>
          </div>

          <div className="purchase-dialog-button-container">
            <button className="purchase-dialog-accept" onClick={() => this.props.purchase(dialogData.id, this.state.count)} style={buyBtnStyle} disabled={!hasEnoughGold}><img src="/inventory/confirm_icon.png" alt="confirm" />Buy</button>
            <button className="purchase-dialog-decline" onClick={this.handleCloseDialog}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
          </div>
        </div>
      </Modal>
    );
  }
}

export default PurchaseDialog;