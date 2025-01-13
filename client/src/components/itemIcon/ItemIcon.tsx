import './ItemIcon.style.css';
import { h, Component } from 'preact';
import { InventoryActionType, InventoryType, ItemDialogType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import ItemDialog from '../itemDialog/ItemDialog';
import { Effect } from '@legion/shared/interfaces';
import { mapFrameToCoordinates, cropFrame } from '../utils';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

interface ItemIconProps {
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  actionType: InventoryType;
  hideHotKey?: boolean;
  refreshCharacter?: () => void;
  handleItemEffect?: (effects: Effect[], actionType: InventoryActionType, index?: number) => void;
  onActionClick?: (type: string, letter: string, index: number) => void; 
  handleSelectedEquipmentSlot: (newValue: number) => void; 
}

interface ItemIconState {
  openModal: boolean;
  modalType: ItemDialogType;
  modalData: BaseItem | BaseSpell | BaseEquipment | null;
  modalPosition: {
    top: number;
    left: number;
  };
  croppedImageUrl: string | null;
}

class ItemIcon extends Component<ItemIconProps, ItemIconState> {
  state: ItemIconState = {
    openModal: false,
    modalType: ItemDialogType.EQUIPMENTS,
    modalData: null,
    modalPosition: {
      top: 0,
      left: 0
    },
    croppedImageUrl: null
  }

  componentDidMount() {
    this.cropSpritesheet();
  }

  componentDidUpdate(prevProps: ItemIconProps) {
    if (prevProps.action !== this.props.action) {
      this.cropSpritesheet();
    }
  }

  cropSpritesheet = async () => {
    const { action, actionType } = this.props;
    if (!action) return;

    const spriteSheetsMap = {
      [InventoryType.CONSUMABLES]: consumablesSpritesheet,
      [InventoryType.SPELLS]: spellsSpritesheet,
      [InventoryType.EQUIPMENTS]: equipmentSpritesheet,
    };
    const spritesheet = spriteSheetsMap[actionType];

    const { x, y } = mapFrameToCoordinates(action.frame);
    try {
      const croppedImageUrl = await cropFrame(spritesheet, x, y, 32, 32); // Assuming 32x32 sprite size
      this.setState({ croppedImageUrl });
    } catch (error) {
      console.error('Error cropping spritesheet:', error);
    }
  }

  convertInventoryTypeToItemDialogType = (inventoryType: InventoryType): ItemDialogType => {
    switch (inventoryType) {
      case InventoryType.CONSUMABLES:
        return ItemDialogType.CONSUMABLES;
      case InventoryType.EQUIPMENTS:
        return ItemDialogType.EQUIPMENTS;
      case InventoryType.SPELLS:
        return ItemDialogType.SPELLS;
      case InventoryType.UTILITIES:
        return ItemDialogType.UTILITIES;
      default:
        throw new Error(`Unsupported InventoryType: ${inventoryType}`);
    }
  }

  handleOpenModal = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment, inventoryType: InventoryType) => {
    const elementRect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Get the height of the modal (approximately)
    const estimatedModalHeight = 200; // Adjust this value based on your modal's actual height
    
    let top = elementRect.top + elementRect.height / 2;
    let left = elementRect.left + elementRect.width / 2;
    
    // Check if the modal would extend below the viewport
    if (top + estimatedModalHeight > viewportHeight) {
        // Position the modal above the item instead
        top = elementRect.top - estimatedModalHeight;
    }
    
    // Ensure the modal stays within the left/right bounds of the viewport
    const viewportWidth = window.innerWidth;
    const estimatedModalWidth = 300; // Adjust based on your modal's width
    
    if (left + estimatedModalWidth > viewportWidth) {
        left = viewportWidth - estimatedModalWidth - 10; // 10px padding from viewport edge
    }
    
    if (left < 0) {
        left = 10; // 10px padding from viewport edge
    }

    const modalPosition = {
        top: Math.max(10, top), // Ensure at least 10px from top of viewport
        left,
    };

    const modalType = this.convertInventoryTypeToItemDialogType(inventoryType);

    this.setState({ openModal: true, modalType, modalPosition, modalData });
  }

  handleCloseModal = () => { 
    this.props.handleSelectedEquipmentSlot(-1); 

    this.setState({ openModal: false });

    if (this.props.handleItemEffect) {
      this.props.handleItemEffect([], InventoryActionType.EQUIP);
    }
  }

  render() {
    const { action, index, actionType, hideHotKey } = this.props;
    const { croppedImageUrl } = this.state;

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === InventoryType.CONSUMABLES ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    const handleOnClickAction = (e: any) => {
      const pathArray = window.location.pathname.split('/');

      if (pathArray[1] === 'game') return;

      if (actionType === InventoryType.EQUIPMENTS) {
        this.props.handleItemEffect(action.effects, InventoryActionType.EQUIP, (action as BaseEquipment).slot);
      } 

      if(actionType === InventoryType.EQUIPMENTS) {
        this.props.handleSelectedEquipmentSlot((action as BaseEquipment).slot); 
      }

      this.handleOpenModal(e, action, actionType);
    }

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    return (
      <div onClick={handleOnClickAction}>
        {action.id > -1 && (
          <div
            className='item-icon'
            style={{
              backgroundImage: croppedImageUrl ? `url(${croppedImageUrl})` : 'none',
              backgroundSize: 'cover',
              cursor: 'pointer',
            }}
          />
        )}
        {!hideHotKey && <span className="key-binding">{keyBinding}</span>}

        <ItemDialog
          index={index}
          isEquipped={false}
          actionType={InventoryActionType.EQUIP}
          dialogOpen={this.state.openModal}
          dialogType={this.state.modalType}
          position={this.state.modalPosition}
          dialogData={this.state.modalData}
          handleClose={this.handleCloseModal}
          handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot} 
        />
      </div>
    );
  }
}

export default ItemIcon;