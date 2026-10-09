import {t, i18n, userError} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';

import { h, Fragment } from 'preact';
import { ItemTooltipContent } from '../ItemTooltipContent';
// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { Component } from 'preact';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat, SPSPendingData, STATS_BG_COLOR, ItemDialogType, StatLabels } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast, mapFrameToCoordinates, cropFrame } from '../utils';
import { getMaxStatValue, getSPIncrement } from '@legion/shared/levelling';
import { PlayerContext } from '../../contexts/PlayerContext';

import {
  canEquipConsumable,
  canLearnSpell,
  canEquipEquipment,
  roomInInventory,
  hasRequiredClass,
  hasMinLevel,
  canIncreaseStat
} from '@legion/shared/inventory';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

import confirmIcon from '@assets/inventory/confirm_icon.png';
import cancelIcon from '@assets/inventory/cancel_icon.png';
import { APICharacterData } from '@legion/shared/interfaces';


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
      successToast(t("Spell learned!"));
    } else if (payload.action === InventoryActionType.SELL) {
      successToast(t("Item sold!"));
    }

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .catch(error => console.error(error));
  }

  spendSP = async (stat: Stat, amount: number) => {
    const payload = {
      stat,
      amount,
      characterId: this.context.getActiveCharacter().id,
    };

    if (!canIncreaseStat(this.context.getActiveCharacter(), stat, amount)) {
      errorToast(t("The maximum value of {{value0}} is {{value1}}", {value0: t(StatLabels[stat]), value1: getMaxStatValue(stat)}));
      return;
    }
    this.context.updateCharacterStats(this.context.getActiveCharacter().id, stat, amount);

    this.props.updateCharacterData();
    this.props.handleClose();
    successToast(t("{{value0}} increased by {{value1}}!", {value0: t(StatLabels[stat]), value1: getSPIncrement(stat)*amount}));

    apiFetch('spendSP', {
      method: 'POST',
      body: payload
    })
      .catch(error => errorToast(userError(error)));
  }

  renderDialogButtons(acceptAction: () => void, isDisabled: boolean = false) {
    const { actionType, dialogType } = this.props;
    let acceptLabel = actionType === InventoryActionType.UNEQUIP ? t('Remove') : t("Equip");
    if (this.props.dialogType === ItemDialogType.SPELLS) {
      acceptLabel = t("Learn");
    } else if (this.props.dialogType === ItemDialogType.SP) {
      acceptLabel = t('Spend');
    }

    // Don't show sell button for SP dialog or equipped items
    const showSellButton = dialogType !== ItemDialogType.SP && actionType === InventoryActionType.EQUIP;

    return (
      <div className="dialog-button-container">
        <button type="button"
          className="dialog-accept"
          disabled={isDisabled}
          onClick={acceptAction}
        >
          <img src={confirmIcon} alt={t("confirm")} />
          {acceptLabel}
        </button>
        {showSellButton && (
          <button type="button"
            className="dialog-sell"
            onClick={() => this.setState({ sellModalShow: true })}
          ><Trans i18n={i18n} i18nKey={"<0/>Sell"} components={[<img src={cancelIcon} alt="" />]} /></button>
        )}
        <button type="button" className="dialog-decline" onClick={this.handleClose}><Trans i18n={i18n} i18nKey={"<0/>Cancel"} components={[<img src={cancelIcon} alt="" />]} /></button>
      </div>
    );
  }

  /** Same card as the hover tooltip, with the inventory actions underneath. */
  renderItemCard(item: BaseItem | BaseSpell | BaseEquipment, type: ItemDialogType, isDisabled: boolean, blockedReason?: string, showActions = true) {
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData | undefined;
    return (
      <div className="item-dialog-card">
        <ItemTooltipContent item={item} showClasses character={activeCharacter} />
        {isDisabled && blockedReason && <p className="item-dialog-blocked" role="status">{blockedReason}</p>}
        {showActions && this.renderDialogButtons(() => this.AcceptAction(type, this.props.index), isDisabled)}
      </div>
    );
  }

  renderEquipmentDialog(dialogData: BaseEquipment) {
    if (!dialogData) return null;
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;
    if (!activeCharacter) return null;
    const isDisabled = this.props.actionType === InventoryActionType.EQUIP && !canEquipEquipment(activeCharacter, dialogData.id);
    const reason = !hasRequiredClass(activeCharacter, dialogData.classes)
      ? t("{{value0}} can’t use this class’s gear.", {value0: activeCharacter.name}) : undefined;
    return this.renderItemCard(dialogData, ItemDialogType.EQUIPMENTS, isDisabled, reason);
  }

  renderConsumableDialog(dialogData: BaseItem) {
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;
    const equipping = this.props.actionType === InventoryActionType.EQUIP;
    const actionAllowed = equipping ? canEquipConsumable(activeCharacter) : roomInInventory(this.context.player);
    const reason = equipping ? t("{{value0}}’s item slots are full.", {value0: activeCharacter?.name}) : t("Your inventory is full.");
    return this.renderItemCard(dialogData, ItemDialogType.CONSUMABLES, !actionAllowed, reason);
  }

  renderSpellDialog(dialogData: BaseSpell) {
    const {isEquipped} = this.props;
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;
    const isDisabled = !canLearnSpell(activeCharacter, dialogData.id);
    const reason = !hasRequiredClass(activeCharacter, dialogData.classes)
      ? t("{{value0}} can’t learn this class’s spells.", {value0: activeCharacter.name})
      : !hasMinLevel(activeCharacter, dialogData.minLevel) ? t("{{value0}} needs level {{value1}}.", {value0: activeCharacter.name, value1: dialogData.minLevel})
      : undefined;
    return <>
      {this.renderItemCard(dialogData, ItemDialogType.SPELLS, isDisabled, reason, !isEquipped)}
      {this.renderSpellConfirmationModal(dialogData, activeCharacter.name)}
    </>;
  }

  renderSpellConfirmationModal(dialogData: BaseSpell, characterName: string) {
    return (
      <div style={{ display: this.state.dialogSpellModalShow ? 'block' : 'none' }} className="dialog-spell-modal">
        <div className="dialog-spell-modal-text">{t("Are you sure you want to teach {{value0}} to {{value1}}?", {value0: t(dialogData.name), value1: characterName})}</div>
        {this.renderDialogButtons(() => {
          this.AcceptAction(ItemDialogType.SPELLS, this.props.index);
          this.setState({ dialogSpellModalShow: false });
        })}
      </div>
    );
  }

  renderSPSpendDialog(dialogData: SPSPendingData) {
    if (this.state.dialogSPModalShow) return this.renderSPConfirmationModal(dialogData);
    const { dialogValue } = this.state;
    const activeCharacter = this.context.getActiveCharacter() as APICharacterData;

    return (
      <div className="character-info-dialog-container">
        <h2 className="sp-dialog-title">{t("Increase {{value0}}", {value0: t(StatLabels[dialogData.stat])})}</h2>
        <div className="character-info-dialog-card-container">
          <div className="character-info-dialog-card" style={{ backgroundColor: STATS_BG_COLOR[StatLabels[dialogData.stat]] }}>
            <span>{t(StatLabels[dialogData.stat])}</span>
          </div>
          <div className="character-info-dialog-card-text">
            {dialogData.value}
            <span className='character-info-addition' style={{ color: '#9ed94c' }}>{t("+ {{value0}}", {value0: getSPIncrement(dialogData.stat) * dialogValue})}</span>
          </div>
        </div>
        <div className="character-info-dialog-control">
          <button type="button" data-game-control className="character-info-dialog-control-btn" onClick={() => this.setState(prevState => ({ dialogValue: Math.max(1, prevState.dialogValue - 1) }))}>-</button>
          <div className="character-info-dialog-control-val">{dialogValue}</div>
          <button type="button" data-game-control className="character-info-dialog-control-btn" onClick={() => this.setState(prevState => ({ dialogValue: Math.min(activeCharacter.sp, prevState.dialogValue + 1) }))}>+</button>
        </div>
        {this.renderDialogButtons(() => this.setState({ dialogSPModalShow: true }))}
      </div>
    );
  }

  renderSPConfirmationModal(dialogData: SPSPendingData) {
    return (
      <div style={{ display: this.state.dialogSPModalShow ? 'block' : 'none' }} className="dialog-spell-modal dialog-SP-modal">
        <div className="dialog-spell-modal-text">{t("Are you sure you want to spend {{value0}} SP?", {value0: this.state.dialogValue})}</div>
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
        <div className="dialog-spell-modal-text">{t("Are you sure you want to sell this item for {{value0}} gold?", {value0: sellPrice})}</div>
        <div className="dialog-button-container">
          <button type="button"
            className="dialog-accept"
            onClick={() => {
              this.AcceptAction(dialogType, index);
              this.setState({ sellModalShow: false });
            }}
          ><Trans i18n={i18n} i18nKey={"<0/>Confirm"} components={[<img src={confirmIcon} alt="" />]} /></button>
          <button type="button"
            className="dialog-decline"
            onClick={() => this.setState({ sellModalShow: false })}
          ><Trans i18n={i18n} i18nKey={"<0/>Cancel"} components={[<img src={cancelIcon} alt="" />]} /></button>
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
    const { position, dialogOpen, dialogType } = this.props;
    const isSP = dialogType === ItemDialogType.SP;

    const customStyles = {
      content: {
        top: isSP ? '50%' : position.top,
        left: isSP ? '50%' : position.left,
        transform: isSP ? 'translate(-50%, -50%)' : undefined,
        right: 'auto',
        bottom: 'auto',
        padding: 0,
        border: 'none',
        background: 'transparent',
        overflow: isSP ? 'auto' : 'visible',
        maxWidth: isSP ? 'calc(100vw - 32px)' : undefined,
        maxHeight: isSP ? 'calc(100dvh - 32px)' : undefined,
      },
      overlay: {
        zIndex: 10,
        backgroundColor: 'transparent',
      }
    };

    return (
      <Modal isOpen={dialogOpen} contentLabel={isSP ? t("Spend stat points") : t("Item details")} style={customStyles} onRequestClose={this.handleClose}
        onAfterOpen={({contentEl}) => {
          if (isSP) return;
          const {width, height} = contentEl.getBoundingClientRect();
          contentEl.style.top = `${Math.max(24, Math.min(position.top, window.innerHeight - height - 16))}px`;
          contentEl.style.left = `${Math.max(16, Math.min(position.left, window.innerWidth - width - 16))}px`;
        }}>
        {this.renderDialogContent()}
        {this.renderSellConfirmationModal()}
      </Modal>
    );
  }
}

export default ItemDialog;
