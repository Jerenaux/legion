import './ItemIcon.style.css';
import { h, Component } from 'preact';
import { InventoryActionType, InventoryType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import ItemDialog from '../itemDialog/ItemDialog';
import { CHARACTER_INFO, ItemDialogType } from '../itemDialog/ItemDialogType';
import { Effect } from '@legion/shared/interfaces';
import { mapFrameToCoordinates } from '../utils';

interface ItemIconProps {
  characterId?: string,
  characterName?: string,
  characterLevel?: number, 
  characterClass?: number, 
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  actionType: InventoryType;
  hideHotKey?: boolean;
  refreshCharacter?: () => void;
  handleItemEffect?: (effects: Effect[], actionType: InventoryActionType, index?: number) => void;
  updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
  onActionClick?: (type: string, letter: string, index: number) => void; 
  handleSelectedEquipmentSlot: (newValue: number) => void; 
}
/* eslint-disable react/prefer-stateless-function */

class ItemIcon extends Component<ItemIconProps> {
  state = {
    openModal: false,
    modalType: ItemDialogType.EQUIPMENTS,
    modalData: null,
    modalPosition: {
      top: 0,
      left: 0
    }
  }

  handleOpenModal = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment | CHARACTER_INFO, modalType: string) => {
    const elementRect = e.currentTarget.getBoundingClientRect();

    const modalPosition = {
      top: elementRect.top + elementRect.height / 2,
      left: elementRect.left + elementRect.width / 2,
    };

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
    const { action, index, actionType, hideHotKey, onActionClick } = this.props;
    // console.log('ItemIconProps => ', this.props); 

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === InventoryType.CONSUMABLES ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    const handleOnClickAction = (e: any) => {
      const pathArray = window.location.pathname.split('/');

      if (pathArray[1] === 'game') return;

      if (actionType === InventoryType.EQUIPMENTS) {
        this.props.handleItemEffect(action.effects, InventoryActionType.EQUIP, (action as BaseEquipment).slot);
      } 

      // console.log("itemIconE => ", e); 
      // console.log("itemIconAction => ", action); 
      // console.log("itemIconActionType => ", actionType); 

      if(actionType === InventoryType.EQUIPMENTS) {
        this.props.handleSelectedEquipmentSlot((action as BaseEquipment).slot); 
      }

      this.handleOpenModal(e, action, actionType);
    }

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    const spriteSheetsMap = {
      [InventoryType.CONSUMABLES]: 'consumables',
      [InventoryType.SKILLS]: 'spells',
      [InventoryType.EQUIPMENTS]: 'equipment'
    }
    const spritesheet = spriteSheetsMap[actionType];

    // console.log("spriteSheet => ", spritesheet); 
    // console.log("actionFrame => ", action.frame); 

    return (
      <div
        onClick={handleOnClickAction}>
        {action.id > -1 && <div
          className='item-icon'
          style={{
            backgroundImage: `url(/${spritesheet}.png)`,
            backgroundPosition: `-${mapFrameToCoordinates(action.frame).x}px -${mapFrameToCoordinates(action.frame).y}px`,
            cursor: 'pointer',
          }}
        />}
        {!hideHotKey && <span className="key-binding">{keyBinding}</span>}

        <ItemDialog
          index={index}
          isEquipped={false}
          characterId={this.props.characterId}
          characterName={this.props.characterName}
          characterLevel={this.props.characterLevel} 
          characterClass={this.props.characterClass} 
          actionType={InventoryActionType.EQUIP}
          dialogOpen={this.state.openModal}
          dialogType={this.state.modalType}
          position={this.state.modalPosition}
          dialogData={this.state.modalData}
          handleClose={this.handleCloseModal}
          refreshCharacter={this.props.refreshCharacter}
          updateInventory={this.props.updateInventory} 
          handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot} 
        />
      </div>
    );
  }
}

export default ItemIcon;