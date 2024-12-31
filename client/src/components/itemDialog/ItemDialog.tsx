// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat, Target, statFieldsByIndex, SPSPendingData, STATS_BG_COLOR, ItemDialogType, StatLabels } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast, mapFrameToCoordinates, classEnumToString, cropFrame } from '../utils';
import { getMaxStatValue, getSPIncrement } from '@legion/shared/levelling';
import { PlayerContext } from '../../contexts/PlayerContext';

import {
  canEquipConsumable,
  canLearnSpell,
  canEquipEquipment,
  roomInInventory,
  hasMinLevel,
  hasRequiredClass,
  canIncreaseStat
} from '@legion/shared/inventory';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

import confirmIcon from '@assets/inventory/confirm_icon.png';
import cancelIcon from '@assets/inventory/cancel_icon.png';
import mpIcon from '@assets/inventory/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';
import { APICharacterData } from '@legion/shared/interfaces';

import { getConsumableById } from "@legion/shared/Items";
import { getSpellById } from "@legion/shared/Spells";
import { getEquipmentById } from "@legion/shared/Equipments";
import { getSellPrice } from '@legion/shared/inventory';

Modal.setAppElement('#root');
interface DialogProps {
  index?: number;
  isEquipped?: boolean;
  actionType: InventoryActionType;
  dialogType: ItemDialogType; 
  dialogOpen: boolean;
  dialogData: BaseItem | BaseSpell | BaseEquipment | SPSPendingData | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  handleSelectedEquipmentSlot: (newValue: number) => void; 
  updateCharacterData?: () => void;
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
  croppedImages: {
    [key: string]: string | null;
  };
  sellModalShow: boolean;
}

class ItemDialog extends Component<DialogProps, DialogState> {
  static contextType = PlayerContext; 

  constructor(props: DialogProps) {
    super(props);
    this.state = {
      ...this.getInitialState(),
      croppedImages: {},
    };
  }

  getInitialState(): Omit<DialogState, 'croppedImages'> {
    return {
      dialogSpellModalShow: false,
      dialogSPModalShow: false,
      sellModalShow: false,
      dialogValue: 1,
      inventory: {
        consumables: [],
        equipment: [],
        spells: [],
      },
    };
  }

  componentDidMount() {
    this.cropSprites();
  }

  componentDidUpdate(prevProps: DialogProps) {
    if (this.props.dialogOpen && !prevProps.dialogOpen) {
      this.setState({ dialogValue: 1 });
      this.cropSprites();
    }
  }

  cropSprites = async () => {
    const { dialogType, dialogData } = this.props;
    if (!dialogData || !('frame' in dialogData) ) return;

    const spriteSheetsMap = {
      [ItemDialogType.EQUIPMENTS]: equipmentSpritesheet,
      [ItemDialogType.CONSUMABLES]: consumablesSpritesheet,
      [ItemDialogType.SPELLS]: spellsSpritesheet,
    };

    const spritesheet = spriteSheetsMap[dialogType];
    if (!spritesheet) return;

    const { x, y } = mapFrameToCoordinates(dialogData.frame);
    try {
      const croppedImageUrl = await cropFrame(spritesheet, x, y, 32, 32); // Assuming 32x32 sprite size
      this.setState(prevState => ({
        croppedImages: {
          ...prevState.croppedImages,
          [dialogType]: croppedImageUrl
        }
      }));
    } catch (error) {
      console.error('Error cropping spritesheet:', error);
    }
  }

  handleClose = () => {
    this.setState({ 
      dialogSPModalShow: false,
      dialogValue: 1  // Reset dialogValue when closing
    });
    this.props.handleClose();
  }

  AcceptAction = (type: ItemDialogType, index: number) => {
    const { actionType } = this.props;

    const payload = {
      index,
      characterId: this.context.getActiveCharacter().id,
      inventoryType: type,
      action: actionType === InventoryActionType.EQUIP && this.state.sellModalShow ? 
        InventoryActionType.SELL : actionType
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ItemDialog] AcceptAction: type: ${type} action: ${payload.action} index: ${index}`);
    }

    this.context.updateInventory(type, payload.action, index);
    this.props.handleClose();

    if (type === ItemDialogType.SPELLS && actionType === InventoryActionType.EQUIP) {
      successToast('Spell learned!');
    } else if (payload.action === InventoryActionType.SELL) {
      successToast('Item sold!');
    }

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .catch(error => console.error(`Error: ${error}`));
  }

  spendSP = async (stat: Stat, amount: number) => {  
    const payload = {
      stat,
      amount,
      characterId: this.context.getActiveCharacter().id,
    };

    if (!canIncreaseStat(this.context.getActiveCharacter(), stat, amount)) {
      errorToast(`The maximum value of ${StatLabels[stat]} is ${getMaxStatValue(stat)}`);
      return;
    }
    this.context.updateCharacterStats(this.context.getActiveCharacter().id, stat, amount);

    this.props.updateCharacterData();
    this.props.handleClose();
    successToast(`${statFieldsByIndex[stat].toUpperCase()} increased by ${getSPIncrement(stat)*amount}!`);

    apiFetch('spendSP', {
      method: 'POST',
      body: payload
    })
      .catch(error => errorToast(`Error: ${error}`));
  }

  getSpritePosition(frame: number) {
    const coordinates = mapFrameToCoordinates(frame);
    return `${-coordinates.x + 5}px ${-coordinates.y + 5}px`;
  }

  renderDialogButtons(acceptAction: () => void, isDisabled: boolean = false) {
    const { actionType, dialogType } = this.props;
    let acceptLabel = actionType == InventoryActionType.UNEQUIP ? 'Remove' : 'Equip';
    if (this.props.dialogType === ItemDialogType.SPELLS) {
      acceptLabel = 'Learn';
    } else if (this.props.dialogType === ItemDialogType.SP) {
      acceptLabel = 'Spend';
    }

    // Don't show sell button for SP dialog or equipped items
    const showSellButton = dialogType !== ItemDialogType.SP && actionType === InventoryActionType.EQUIP;

    return (
      <div className="dialog-button-container">
        <button
          className="dialog-accept"
          disabled={isDisabled}
          onClick={acceptAction}
          style={isDisabled ? { backgroundColor: "grey", opacity: "0.5" } : {}}
        >
          <img src={confirmIcon} alt="confirm" />
          {acceptLabel}
        </button>
        {showSellButton && (
          <button 
            className="dialog-sell"
            onClick={() => this.setState({ sellModalShow: true })}
          >
            <img src={cancelIcon} alt="sell" />
            Sell
          </button>
        )}
        <button className="dialog-decline" onClick={this.handleClose}>
          <img src={cancelIcon} alt="decline" />
          Cancel
        </button>
      </div>
    );
  }

  renderEquipmentDialog(dialogData: BaseEquipment) {
    if (!dialogData) return null;
    const { index } = this.props;
    const backgroundPosition = this.getSpritePosition(dialogData.frame);
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;
    if (!activeCharacter) return null;
    const isDisabled = this.props.actionType == InventoryActionType.EQUIP && !canEquipEquipment(activeCharacter, dialogData.id);

    return (
      <div className="equip-dialog-container">
        <div className="equip-dialog-image" style={{
          backgroundImage: `url(${this.state.croppedImages[ItemDialogType.EQUIPMENTS] || ''})`,
          backgroundSize: 'cover',
        }} />
        <p className="equip-dialog-name">{dialogData.name}</p>
        <div style={{ backgroundColor: hasMinLevel(activeCharacter, dialogData.minLevel) ? "#2f404d" : "darkred" }} className="equip-dialog-lvl">
          Lvl <span>{dialogData.minLevel}</span>
        </div>
        <div className="equip-dialog-class-container">
          {dialogData.classes?.map((item) => (
            <div style={!hasRequiredClass(activeCharacter, dialogData.classes) ? { backgroundColor: "darkred" } : {}} className="equip-dialog-class">
              {classEnumToString(item)}
            </div>
          ))}
        </div>
        {dialogData.description && <p className="equip-dialog-desc">{dialogData.description}</p>}
        {this.renderDialogButtons(() => this.AcceptAction(ItemDialogType.EQUIPMENTS, index), isDisabled)}
      </div>
    );
  }

  renderConsumableDialog(dialogData: BaseItem) {
    const { index } = this.props;
    const backgroundPosition = this.getSpritePosition(dialogData.frame);
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;

    const actionAllowed = 
      this.props.actionType === InventoryActionType.EQUIP ?
      canEquipConsumable(activeCharacter) :
      roomInInventory(this.context.player);

    return (
      <div className="dialog-item-container">
        <div className="dialog-item-heading-bg"></div>
        <div className="dialog-item-heading">
        <div className="dialog-item-heading-image" style={{ 
            backgroundImage: `url(${this.state.croppedImages[ItemDialogType.CONSUMABLES] || ''})`,
            backgroundSize: 'cover',
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
          {dialogData.effects.map(effect => (
            <div className="dialog-item-info">
              <div className="character-info-dialog-card" style={{ backgroundColor: STATS_BG_COLOR[Stat[effect.stat]] }}><span>{Stat[effect.stat]}</span></div>
              <span style={{ color: effect.value > 0 || effect.value == -1 ? '#9ed94c' : '#c95a74' }}>
                {effect.value > 0 ? `+${effect.value}` : (effect.value == -1 ? '∞' : effect.value)}
              </span>
            </div>
          ))}
        </div>
        {this.renderDialogButtons(
            () => this.AcceptAction(ItemDialogType.CONSUMABLES, index),
            !actionAllowed
          )}
      </div>
    );
  }

  renderSpellDialog(dialogData: BaseSpell) {
    const { index, isEquipped } = this.props;
    const backgroundPosition = this.getSpritePosition(dialogData.frame);
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;
    const isDisabled = !canLearnSpell(activeCharacter, dialogData.id);

    return (
      <div className="dialog-spell-container">
        <div className="spell-wrapper">
        <div className="dialog-spell-container-image" style={{ 
            backgroundImage: `url(${this.state.croppedImages[ItemDialogType.SPELLS] || ''})`,
            backgroundSize: 'cover',
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
        <div style={{ backgroundColor: hasMinLevel(activeCharacter, dialogData.minLevel) ? "#2f404d" : "darkred" }} className="equip-dialog-lvl">
          Lvl <span>{dialogData.minLevel}</span>
        </div> 
        <div className="equip-dialog-class-container">
          {dialogData.classes?.map((item) => (
            <div style={!hasRequiredClass(activeCharacter, dialogData.classes) ? { backgroundColor: "darkred" } : {}} className="equip-dialog-class">
              {classEnumToString(item)}
            </div>
          ))}
        </div>
        {!isEquipped && this.renderDialogButtons(() => this.AcceptAction(ItemDialogType.SPELLS, index), isDisabled)}
        {this.renderSpellConfirmationModal(dialogData, activeCharacter.name)}
      </div>
    );
  }

  renderSpellConfirmationModal(dialogData: BaseSpell, characterName: string) {
    return (
      <div style={{ display: this.state.dialogSpellModalShow ? 'block' : 'none' }} className="dialog-spell-modal">
        <div className="dialog-spell-modal-text">
          Are you sure you want to teach {dialogData.name} to {characterName}?
        </div>
        {this.renderDialogButtons(() => {
          this.AcceptAction(ItemDialogType.SPELLS, this.props.index);
          this.setState({ dialogSpellModalShow: false });
        })}
      </div>
    );
  }

  renderSPSpendDialog(dialogData: SPSPendingData) {
    const { dialogValue } = this.state;
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;

    return (
      <div className="character-info-dialog-container">
        <div className="character-info-dialog-card-container">
          <div className="character-info-dialog-card" style={{ backgroundColor: STATS_BG_COLOR[StatLabels[dialogData.stat]] }}>
            <span>{StatLabels[dialogData.stat]}</span>
          </div>
          <div className="character-info-dialog-card-text">
            {dialogData.value}
            <span className='character-info-addition' style={{ color: '#9ed94c' }}>
              &nbsp; + {getSPIncrement(dialogData.stat) * dialogValue}
            </span>
          </div>
        </div>
        <div className="character-info-dialog-control">
          <div className="character-info-dialog-control-btn" onClick={() => this.setState(prevState => ({ dialogValue: Math.max(1, prevState.dialogValue - 1) }))}>-</div>
          <div className="character-info-dialog-control-val">{dialogValue}</div>
          <div className="character-info-dialog-control-btn" onClick={() => this.setState(prevState => ({ dialogValue: Math.min(activeCharacter.sp, prevState.dialogValue + 1) }))}>+</div>
        </div>
        {this.renderDialogButtons(() => this.setState({ dialogSPModalShow: true }))}
        {this.renderSPConfirmationModal(dialogData)}
      </div>
    );
  }

  renderSPConfirmationModal(dialogData: SPSPendingData) {
    return (
      <div style={{ display: this.state.dialogSPModalShow ? 'block' : 'none' }} className="dialog-spell-modal dialog-SP-modal">
        <div className="dialog-spell-modal-text">
          Are you sure you want to spend {this.state.dialogValue} SP?
        </div>
        {this.renderDialogButtons(() => {
          this.spendSP(dialogData.stat, this.state.dialogValue);
          this.setState({ dialogSPModalShow: false });
        })}
      </div>
    );
  }

  renderSellConfirmationModal() {
    const { dialogType, index, dialogData } = this.props;
    if (!dialogData || !('id' in dialogData)) return null;
    
    const sellPrice = getSellPrice(dialogData.id, dialogType);
    return (
      <div style={{ display: this.state.sellModalShow ? 'block' : 'none' }} className="dialog-spell-modal">
        <div className="dialog-spell-modal-text">
          Are you sure you want to sell this item for {sellPrice} gold?
        </div>
        <div className="dialog-button-container">
          <button
            className="dialog-accept"
            onClick={() => {
              this.AcceptAction(dialogType, index);
              this.setState({ sellModalShow: false });
            }}
          >
            <img src={confirmIcon} alt="confirm" />
            Confirm
          </button>
          <button 
            className="dialog-decline" 
            onClick={() => this.setState({ sellModalShow: false })}
          >
            <img src={cancelIcon} alt="decline" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  renderDialogContent() {
    const { dialogType, dialogData } = this.props;

    switch (dialogType) {
      case ItemDialogType.EQUIPMENTS:
        return this.renderEquipmentDialog(dialogData as BaseEquipment);
      case ItemDialogType.CONSUMABLES:
        return this.renderConsumableDialog(dialogData as BaseItem);
      case ItemDialogType.SPELLS:
        return this.renderSpellDialog(dialogData as BaseSpell);
      case ItemDialogType.SP:
        return this.renderSPSpendDialog(dialogData as SPSPendingData);
      default:
        return null;
    }
  }

  render() {
    const { position, dialogOpen } = this.props;

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

    return (
      <Modal isOpen={dialogOpen} style={customStyles} onRequestClose={this.handleClose}>
        {this.renderDialogContent()}
        {this.renderSellConfirmationModal()}
      </Modal>
    );
  }
}

export default ItemDialog;