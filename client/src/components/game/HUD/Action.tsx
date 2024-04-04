import './HUD.style.css';
import { h, Component } from 'preact';
import { InventoryActionType, InventoryType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import ItemDialog from '../../itemDialog/ItemDialog';
import { CHARACTER_INFO, ItemDialogType } from '../../itemDialog/ItemDialogType';
import { Effect } from '@legion/shared/interfaces';

interface ActionItemProps {
  characterId?: string,
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  clickedIndex: number;
  canAct: boolean;
  actionType: InventoryType;
  hideHotKey?: boolean;
  refreshCharacter?: () => void;
  handleItemEffect?: (effects: Effect[], actionType: InventoryActionType) => void;
  onActionClick?: (type: string, letter: string, index: number) => void;
}
/* eslint-disable react/prefer-stateless-function */

class Action extends Component<ActionItemProps> {
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

      this.setState({openModal: true, modalType, modalPosition, modalData});
  }

  handleCloseModal = () => {
      this.setState({openModal: false});
      this.props.handleItemEffect([], InventoryActionType.EQUIP);
  }

  render() {
    const { action, index, clickedIndex, canAct, actionType, hideHotKey, onActionClick } = this.props;

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === InventoryType.CONSUMABLES ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    const handleOnClickAction = (e: any) => {
      if (actionType === InventoryType.EQUIPMENTS) {
        this.props.handleItemEffect(action.effects, InventoryActionType.EQUIP);
      }

      this.handleOpenModal(e, action, actionType);
    }

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    return (
      <div 
        className={`${actionType} ${index === clickedIndex ? 'flash-effect' : ''}`} 
        onClick={handleOnClickAction}>
        {action.id > -1 && <div 
          className={!canAct ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
          style={{backgroundImage: `url(/${actionType}/${action.frame})`, cursor: 'pointer'}}
          />}
        {!hideHotKey && <span className="key-binding">{keyBinding}</span>}
        {/* {action.id > -1 && <div className="info-box box">
          <InfoBox action={action} />
        </div>} */}
        
        <ItemDialog 
          index={index}
          isEquipped={false}
          characterId={this.props.characterId} 
          actionType={InventoryActionType.EQUIP} 
          dialogOpen={this.state.openModal} 
          dialogType={this.state.modalType} 
          position={this.state.modalPosition} 
          dialogData={this.state.modalData} 
          handleClose={this.handleCloseModal}
          refreshCharacter={this.props.refreshCharacter} 
        />
      </div>
    );
  }
}

export default Action;