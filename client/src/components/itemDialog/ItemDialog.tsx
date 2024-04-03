// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from './ItemDialogType';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast } from '../utils';

Modal.setAppElement('#root');
interface DialogProps {
  characterId?: string;
  index?: number;
  actionType: InventoryActionType;
  dialogType: string;
  dialogOpen: boolean;
  dialogData: BaseItem | BaseSpell | BaseEquipment | CHARACTER_INFO | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  refreshInventory?: () => void;
}

class ItemDialog extends Component<DialogProps> {

  AcceptAction = (type: string, index: number) => {
    if (!this.props.characterId) return;

    const payload = {
      index,
      characterId: this.props.characterId,
      inventoryType: type,
      action: this.props.actionType
    };

    console.log('333333333333', payload);

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          successToast(this.props.actionType > 0 ? 'Item un-equipped!' : 'Item equipped!');
          this.props.refreshInventory();
        } else {
          errorToast('Character inventory is full!');
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

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

    const getInfoVal = (val: string) => {
      if (val === undefined) return '+1';
      return Number(val) < 0 ? Number(val) + 1 : `+${Number(val) + 1}`;
    };

    const equipmentDialog = (dialogData: BaseEquipment) => {
      if (!dialogData.frame) return null;
      return (
        <div className="equip-dialog-container">
          <img src={`/${dialogType}/${dialogData.frame}`} alt={dialogData.name} />
          <p className='equip-dialog-name'>{dialogData.name}</p>
          <p className='equip-dialog-desc'>Remove Item</p>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src="/inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      )
    };

    const consumableDialog = (dialogData: BaseItem) => {
      if (!dialogData.frame) return;

      return (
        <div className="dialog-item-container">
          <div className="dialog-item-heading">
            <img src={`/${dialogType}/${dialogData.frame}`} alt={dialogData.name} />
            <div className="dialog-item-title">
              <span>{dialogData.name}</span>
              <span className="dialog-item-title-info">Self</span>
            </div>
          </div>
          <p className="dialog-item-desc">{dialogData.description}</p>
          <div className="dialog-item-info-container">
            {
              dialogData.effects.map(effect => 
                <div className="dialog-item-info">
                  <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[Stat[effect.stat]] }}><span>{Stat[effect.stat]}</span></div>
                  <span style={effect.value > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{effect.value > 0 ? `+${effect.value}` : effect.value}</span>
                </div>
              )
            }
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src="/inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      );
    };

    const skillDialog = (dialogData: BaseSpell) => {
      if (!dialogData.frame) return;
      return (
        <div className="dialog-spell-container">
          <img src={`/${dialogType}/${dialogData.frame}`} alt={dialogData.name} />
          <p className="dialog-spell-name">{dialogData.name}</p>
          <p className="dialog-spell-desc">{dialogData.description}</p>
          {/* <div className="dialog-spell-info-container">
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
          </div> */}
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src="/inventory/confirm_icon.png" alt="confirm" /></button>
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" /></button>
          </div>
        </div>
      )
    };

    const characterInfoDialog = (dialogData: CHARACTER_INFO) => (
      <div className="character-info-dialog-container">
        <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[dialogData.key]] }}><span>{INFO_TYPE[dialogData.key]}</span></div>
        <p>
          {dialogData.value} 
          <span className='character-info-addition' style={dialogData.effect && Number(dialogData.effect) < 0 ? { color: '#c95a74' } : { color: '#9ed94c' }}>{getInfoVal(dialogData.effect)}</span>
        </p>
        <div className="dialog-button-container">
          <button className="dialog-accept" onClick={() => console.log('___SP spent___')}><img src="/inventory/confirm_icon.png" alt="confirm" /></button>
          <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" /></button>
        </div>
      </div>
    );

    const renderBody = () => {
      switch (dialogType) {
        case ItemDialogType.EQUIPMENTS:
          return equipmentDialog(dialogData as BaseEquipment);
        case ItemDialogType.CONSUMABLES:
          return consumableDialog(dialogData as BaseItem);
        case ItemDialogType.SKILLS:
          return skillDialog(dialogData as BaseSpell);
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