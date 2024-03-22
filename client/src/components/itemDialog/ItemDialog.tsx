// ItemDialog.tsx
import './ItemDialog.style.css';
import { h, Component } from 'preact';
import Modal from 'react-modal';
import { CHARACTER_INFO, CONSUMABLE, EQUIPMENT, INFO_BG_COLOR, INFO_TYPE, ItemDialogType, SPELL } from './ItemDialogType';

Modal.setAppElement('#root');
interface DialogProps {
  dialogType: string;
  dialogOpen: boolean;
  dialogData: EQUIPMENT | CONSUMABLE | CHARACTER_INFO | SPELL | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
}

class ItemDialog extends Component<DialogProps> {

  render() {
    const { dialogType, dialogData, position, dialogOpen, handleClose } = this.props;

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

    const equipmentDialog = (dialogData: EQUIPMENT) => {
      if (!dialogData.url) return null;
      return (
        <div className="equip-dialog-container">
          <img src={dialogData.url} alt={dialogData.name} />
          <p className='equip-dialog-name'>{dialogData.name}</p>
          <p className='equip-dialog-desc'>Remove Item</p>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={handleClose}><img src="./inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="./inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      )
    };

    const consumableDialog = (dialogData: CONSUMABLE) => {
      if (!dialogData.url) return;

      return (
        <div className="dialog-item-container">
          <div className="dialog-item-heading">
            <img src={dialogData.url} alt={dialogData.name} />
            <div className="dialog-item-title">
              <span>{dialogData.name}</span>
              <span className="dialog-item-title-info">Self</span>
            </div>
          </div>
          <p className="dialog-item-desc">{dialogData.desc}</p>
          <div className="dialog-item-info-container">
            {
              Object.entries(dialogData.info).map(([type, val]) => ({ type, val })).map((item) => (
                <div className="dialog-item-info">
                  <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[item.type]] }}><span>{item.type.toUpperCase()}</span></div>
                  <span style={item.val > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{item.val > 0 ? `+${item.val}` : item.val}</span>
                </div>
              ))
            }
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={handleClose}><img src="./inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="./inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      );
    };

    const skillDialog = (dialogData: SPELL) => {
      if (!dialogData.url) return;
      return (
        <div className="dialog-spell-container">
          <img src={dialogData.url} alt={dialogData.name} />
          <p className="dialog-spell-name">{dialogData.name}</p>
          <p className="dialog-spell-desc">{dialogData.desc}</p>
          <div className="dialog-spell-info-container">
            <div className="dialog-spell-info">
              <img src={'./inventory/mp_icon.png'} alt="mp" />
              <span>{dialogData.info.mp}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'./inventory/cd_icon.png'} alt="cd" />
              <span>{dialogData.info.cd}s</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'./inventory/target_icon.png'} alt="target" />
              <span>ADE</span>
            </div>
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={handleClose}><img src="./inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="./inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      )
    };

    const characterInfoDialog = (dialogData: CHARACTER_INFO) => (
      <div className="character-info-dialog-container">
        <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[dialogData.name] }}><span>{dialogData.name}</span></div>
        <p>{dialogData.currVal} <span style={dialogData.additionVal && Number(dialogData.additionVal) > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{dialogData.additionVal}</span></p>
        <div className="dialog-button-container">
          <button className="dialog-accept" onClick={handleClose}><img src="./inventory/confirm_icon.png" alt="confirm" /></button>
          <button className="dialog-decline" onClick={handleClose}><img src="./inventory/cancel_icon.png" alt="decline" /></button>
        </div>
      </div>
    );

    const renderBody = () => {
      switch (dialogType) {
        case ItemDialogType.EQUIPMENTS:
          return equipmentDialog(dialogData as EQUIPMENT);
        case ItemDialogType.CONSUMABLES:
          return consumableDialog(dialogData as CONSUMABLE);
        case ItemDialogType.SKILLS:
          return skillDialog(dialogData as SPELL);
        case ItemDialogType.CHARACTER_INFO:
          return characterInfoDialog(dialogData as CHARACTER_INFO);
        default: null;
      }
    }

    return (
      <Modal isOpen={dialogOpen} style={customStyles} onRequestClose={handleClose}>
        {renderBody()}
      </Modal>
    );
  }
}

export default ItemDialog;