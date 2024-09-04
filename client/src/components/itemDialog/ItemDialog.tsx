// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';
import { SPSPendingData, STATS_BG_COLOR, STATS_NAMES, ItemDialogType } from './ItemDialogType';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat, Target, statFields } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast, mapFrameToCoordinates, classEnumToString } from '../utils';
import { getSPIncrement } from '@legion/shared/levelling';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

import confirmIcon from '@assets/inventory/confirm_icon.png';
import cancelIcon from '@assets/inventory/cancel_icon.png';
import mpIcon from '@assets/inventory/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';

Modal.setAppElement('#root');
interface DialogProps {
  characterId?: string;
  characterSp?: number;
  characterName?: string;
  characterLevel?: number; 
  characterClass?: number; 
  index?: number;
  isEquipped?: boolean;
  actionType: InventoryActionType;
  dialogType: string;
  dialogOpen: boolean;
  dialogData: BaseItem | BaseSpell | BaseEquipment | SPSPendingData | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  refreshCharacter?: () => void;
  updateInventory?: (type: string, action: InventoryActionType, index: number) => void; 
  updateStats?: (stat: Stat, amount: number) => void;
  handleSelectedEquipmentSlot: (newValue: number) => void; 
}

interface DialogState {
  dialogSpellModalShow: boolean; 
  dialogSPModalShow: boolean; 
  dialogValue: number;
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
}

class ItemDialog extends Component<DialogProps, DialogState> {
  constructor(props: DialogProps) {
    super(props);
    this.state = {
      dialogSpellModalShow: false, 
      dialogSPModalShow: false, 
      dialogValue: 1,
      inventory: {
        consumables: [],
        equipment: [],
        spells: [],
      },
    };
  }

  async componentDidMount() {
    await this.fetchInventoryData();
  }

  fetchInventoryData = async () => {
    try {
      const data = await apiFetch('inventoryData');
      this.setState({
        inventory: {
          consumables: data.inventory.consumables?.sort(),
          equipment: data.inventory.equipment?.sort(),
          spells: data.inventory.spells?.sort(),
        },
      });
    } catch (error) {
      errorToast(`Error: ${error}`);
    }
  }

  AcceptAction = (type: string, index: number) => {
    if (!this.props.characterId) return;

    const payload = {
      index,
      characterId: this.props.characterId,
      inventoryType: type,
      action: this.props.actionType
    };

    if (this.props.updateInventory) this.props.updateInventory(type, this.props.actionType, index)
    this.props.handleClose();

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {          
          this.props.refreshCharacter();
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

  spendSP = (stat: Stat, amount: number) => {
    if (!this.props.characterId) return;
  
    const payload = {
      stat,
      amount,
      characterId: this.props.characterId,
    };

    this.props.updateStats(stat, amount);
    this.props.handleClose();

    apiFetch('spendSP', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          successToast(`${statFields[stat].toUpperCase()} increased by ${getSPIncrement(stat)*amount}!`);
          
          this.props.refreshCharacter();
        } else {
          errorToast('Not enough SP!');
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

  render() {
    const decrementValue = () => {
      if (this.state.dialogValue > 1) {
        this.setState({
          dialogValue: this.state.dialogValue - 1
        });
      }
    }

    const incrementValue = () => {
      if (this.state.dialogValue < this.props.characterSp) {
        this.setState({
          dialogValue: this.state.dialogValue + 1
        });
      }
    }

    const { dialogType, dialogData, position, dialogOpen, isEquipped, handleClose } = this.props;

    let acceptBtn = this.props.actionType > 0 ? 'Remove' : 'Equip';
    // If dialogData is of type spell , display "Learn" instead of "Equip"
    if (dialogType === ItemDialogType.SKILLS) {
      acceptBtn = 'Learn';
    }

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

    const equipmentDialog = (dialogData: BaseEquipment) => {
      if (!dialogData) return null;

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 5;
      coordinates.y = -coordinates.y + 5;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;

      return (
        <div className="equip-dialog-container">
          <div className="equip-dialog-image" style={{
            backgroundImage: `url(${equipmentSpritesheet})`,
            backgroundPosition,
          }} />
          <p className="equip-dialog-name">{dialogData.name}</p>
          <div style={this.props.characterLevel >= dialogData.minLevel ? { backgroundColor: "#2f404d" } : { backgroundColor: "darkred" }} className="equip-dialog-lvl">
            Lvl <span>{dialogData.minLevel}</span>
          </div> 
          <div className="equip-dialog-class-container">
            {dialogData.classes?.map((item) =>
              <div style={dialogData.classes.length > 0 && !dialogData.classes.includes(this.props.characterClass) && {backgroundColor: "darkred"}} className="equip-dialog-class">
                {classEnumToString(item)}
              </div>
            )}
          </div>
          {dialogData.description && <p className="equip-dialog-desc">{dialogData.description}</p>}
          <div className="dialog-button-container">
            <button
              style={(this.props.characterLevel < dialogData.minLevel || (dialogData.classes.length > 0 && !dialogData.classes.includes(this.props.characterClass))) ? { backgroundColor: "grey", opacity: "0.5" } : {}}
              className="dialog-accept"
              disabled={(this.props.characterLevel < dialogData.minLevel || (dialogData.classes.length > 0 && !dialogData.classes.includes(this.props.characterClass)))}
              onClick={() => this.AcceptAction(dialogType, this.props.index)}
            >
              <img src={confirmIcon} alt="confirm" />
              {acceptBtn}
            </button>
            <button className="dialog-decline" onClick={handleClose}>
              <img src={cancelIcon} alt="decline" />
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
              backgroundImage: `url(${consumablesSpritesheet})`,
              backgroundPosition,
            }} />
            <div className="dialog-item-title">
              <span>{dialogData.name}</span>
              <span className="dialog-item-title-info">Self</span>
            </div>
          </div>
          <p className="dialog-item-desc">{dialogData.description}</p>
          <div className="dialog-consumable-info-container">
            <div className="dialog-consumable-info">
              <img src={cdIcon} alt="cd" />
              <span>{dialogData.getCooldown()}</span>
            </div>
            <div className="dialog-consumable-info">
              <img src={targetIcon} alt="target" />
              <span>{Target[dialogData.target]}</span>
            </div>
          </div>
          <div className="dialog-item-info-container">
            {
              dialogData.effects.map(effect =>
                <div className="dialog-item-info">
                  <div className="character-info-dialog-card" style={{ backgroundColor: STATS_BG_COLOR[Stat[effect.stat]] }}><span>{Stat[effect.stat]}</span></div>
                  <span style={effect.value > 0 || effect.value == -1 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{effect.value > 0 ? `+${effect.value}` : (effect.value == -1 ? '∞' : effect.value)}</span>
                </div>
              )
            }
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src={confirmIcon} alt="confirm" />{acceptBtn}</button>
            <button className="dialog-decline" onClick={handleClose}><img src={cancelIcon} alt="decline" />Cancel</button>
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
              backgroundImage: `url(${spellsSpritesheet})`,
              backgroundPosition,
            }} />
          </div>
          <p className="dialog-spell-name">{dialogData.name}</p>
          <p className="dialog-spell-desc">{dialogData.description}</p>
          <div className="dialog-spell-info-container">
            <div className="dialog-spell-info">
              <img src={mpIcon} alt="mp" />
              <span>{dialogData.cost}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={cdIcon} alt="cd" />
              <span>{dialogData.getCooldown()}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={targetIcon} alt="target" />
              <span>{Target[dialogData.target]}</span>
            </div>
          </div>
          <div className="dialog-button-container">
            {!isEquipped && <button className="dialog-accept" onClick={() => this.setState({ dialogSpellModalShow: true })}><img src={confirmIcon} alt="confirm" />{acceptBtn}</button>}
            <button className="dialog-decline" onClick={handleClose}><img src={cancelIcon} alt="decline" />Cancel</button>
          </div>
          <div style={this.state.dialogSpellModalShow ? { display: 'block' } : { display: 'none' }} class="dialog-spell-modal">
            <div className="dialog-spell-modal-text">
              Are you sure you want to teach {dialogData.name} to {this.props.characterName}?
            </div>
            <div className="dialog-button-container">
              <button className="dialog-accept" onClick={() => { this.AcceptAction(dialogType, this.props.index); this.setState({ dialogSpellModalShow: false }); }}><img src={confirmIcon} alt="confirm" />Confirm</button>
              <button className="dialog-decline" onClick={() => this.setState({ dialogSpellModalShow: false })}><img src={cancelIcon} alt="decline" />Cancel</button>
            </div>
          </div>
        </div>
      )
    };

    const SPSpendDialog = (dialogData: SPSPendingData) => (
      <div className="character-info-dialog-container">
        <div className="character-info-dialog-card-container">
          <div className="character-info-dialog-card" style={{ backgroundColor: STATS_BG_COLOR[STATS_NAMES[dialogData.stat]] }}><span>{STATS_NAMES[dialogData.stat]}</span></div>
          <div className="character-info-dialog-card-text">
            {dialogData.value}
            <span className='character-info-addition' style={{ color: '#9ed94c' }}>&nbsp; + {getSPIncrement(dialogData.stat) * this.state.dialogValue}</span>
          </div>
        </div>
        <div className="character-info-dialog-control">
          <div className="character-info-dialog-control-btn" onClick={decrementValue}>-</div>
          <div className="character-info-dialog-control-val">{this.state.dialogValue}</div>
          <div className="character-info-dialog-control-btn" onClick={incrementValue}>+</div>
        </div>
        <div className="dialog-button-container">
          <button className="dialog-accept" onClick={() => this.setState({ dialogSPModalShow: true })}><img src={confirmIcon} alt="confirm" />Accept</button>
          <button className="dialog-decline" onClick={handleClose}><img src={cancelIcon} alt="decline" />Cancel</button>
        </div>

        <div style={this.state.dialogSPModalShow ? { display: 'block' } : { display: 'none' }} class="dialog-spell-modal dialog-SP-modal">
          <div className="dialog-spell-modal-text">
            Are you sure you want to spend {this.state.dialogValue} SP?
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => { this.spendSP(dialogData.stat, this.state.dialogValue); this.setState({ dialogSPModalShow: false }); }}><img src={confirmIcon} alt="confirm" />Confirm</button>
            <button className="dialog-decline" onClick={() => this.setState({ dialogSPModalShow: false })}><img src={cancelIcon} alt="decline" />Cancel</button>
          </div>
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
        case ItemDialogType.SP:
          return SPSpendDialog(dialogData as SPSPendingData);
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