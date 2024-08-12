// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from './ItemDialogType';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat, Target } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast, mapFrameToCoordinates } from '../utils';

Modal.setAppElement('#root');
interface DialogProps {
  characterId?: string; 
  characterName?: string; 
  index?: number;
  isEquipped?: boolean;
  actionType: InventoryActionType;
  dialogType: string;
  dialogOpen: boolean;
  dialogData: BaseItem | BaseSpell | BaseEquipment | CHARACTER_INFO | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  refreshCharacter?: () => void;
  updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
} 

interface DialogState { 
  dialogSpellModalShow: boolean; 
}

class ItemDialog extends Component<DialogProps, DialogState> { 
  constructor(props: DialogProps) {
    super(props); 
    this.state = { 
      dialogSpellModalShow: false, 
    }; 
  }

  AcceptAction = (type: string, index: number) => {
    if (!this.props.characterId) return;

    const payload = {
      index, 
      characterId: this.props.characterId, 
      inventoryType: type, 
      action: this.props.actionType 
    };

    if(this.props.updateInventory) this.props.updateInventory(type, this.props.actionType, index)
    this.props.handleClose();

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          // successToast(this.props.actionType > 0 ? 'Item un-equipped!' : 'Item equipped!');
          
          this.props.refreshCharacter();
        // } else {
        //   errorToast('Character inventory is full!');
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

  spendSP = (index: number) => {
    if (!this.props.characterId) return;

    const payload = {
      index,
      characterId: this.props.characterId,
    };

    this.props.handleClose();

    apiFetch('spendSP', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          successToast('SP spent!');
          
          this.props.refreshCharacter();
        } else {
          errorToast('Not enough SP!');
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

  render() { 
    // console.log("characterName => ", this.props.characterName); 

    const { dialogType, dialogData, position, dialogOpen, isEquipped, handleClose } = this.props;

    const acceptBtn = this.props.actionType > 0 ? 'Remove' : 'Equip';

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
      if (!dialogData) return null;

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 5;
      coordinates.y = -coordinates.y + 5;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;
      return (
        <div className="equip-dialog-container">
          <div className="equip-dialog-image" style={{ 
              backgroundImage: `url(equipment.png)`,
              backgroundPosition,
            }} />
          <p className='equip-dialog-name'>{dialogData.name}</p>
          <p className="equip-dialog-desc">{dialogData.description}</p>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}>
              <img src="/inventory/confirm_icon.png" alt="confirm" />
              {acceptBtn}
            </button>
            <button className="dialog-decline" onClick={handleClose}>
              <img src="/inventory/cancel_icon.png" alt="decline" />
              Cancel
            </button>
          </div>
        </div>
      );    
    };

    const consumableDialog = (dialogData: BaseItem) => {
      if (!dialogData) return;

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 5;
      coordinates.y = -coordinates.y + 5;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;
      return (
        <div className="dialog-item-container">
          <div className="dialog-item-heading-bg"></div>
          <div className="dialog-item-heading">
            <div className="dialog-item-heading-image" style={{ 
              backgroundImage: `url(consumables.png)`,
              backgroundPosition,
            }} />
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
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src="/inventory/confirm_icon.png" alt="confirm" />{acceptBtn}</button>
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
          </div>
        </div>
      );
    };

    const skillDialog = (dialogData: BaseSpell) => {
      if (!dialogData) return;

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 0;
      coordinates.y = -coordinates.y + 0;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`; 

      return (
        <div className="dialog-spell-container">
          <div className="spell-wrapper">
            <div className="dialog-spell-container-image" style={{ 
              backgroundImage: `url(spells.png)`,
              backgroundPosition,
            }} />
          </div>
          <p className="dialog-spell-name">{dialogData.name}</p>
          <p className="dialog-spell-desc">{dialogData.description}</p>
          <div className="dialog-spell-info-container">
            <div className="dialog-spell-info">
              <img src={'/inventory/mp_icon.png'} alt="mp" />
              <span>{dialogData.cost}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/cd_icon.png'} alt="cd" />
              <span>{dialogData.cooldown}s</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/target_icon.png'} alt="target" />
              <span>{Target[dialogData.target]}</span>
            </div>
          </div>
          <div className="dialog-button-container">
            {!isEquipped && <button className="dialog-accept" onClick={() => this.setState({dialogSpellModalShow: true})}><img src="/inventory/confirm_icon.png" alt="confirm" />{acceptBtn}</button>}
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
          </div> 
          <div style={this.state.dialogSpellModalShow? {display: 'block'}: {display: 'none'}} class="dialog-spell-modal">
              <div className="dialog-spell-modal-text">
                Are you sure you want to teach {dialogData.name} to {this.props.characterName}?
              </div>
              <div className="dialog-spell-modal-btns">
                <button onClick = {() => {this.AcceptAction(dialogType, this.props.index); this.setState({dialogSpellModalShow: false});}} className="dialog-spell-modal-confirm">Confirm</button> 
                <button onClick={() => this.setState({dialogSpellModalShow: false})} className="dialog-spell-modal-cancel">Cancel</button>
              </div>
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
          <button className="dialog-accept" onClick={() => this.spendSP(0)}><img src="/inventory/confirm_icon.png" alt="confirm" />Accept</button>
          <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
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