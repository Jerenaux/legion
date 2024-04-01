import './HUD.style.css';
import { h, Component } from 'preact';
import { InventoryType } from '@legion/shared/enums';
import InfoBox from '../../InfoBox';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import ItemDialog from '../../itemDialog/ItemDialog';
import { CHARACTER_INFO, CONSUMABLE, EQUIPMENT, ItemDialogType, SPELL } from '../../itemDialog/ItemDialogType';
import { CONSUMABLEITEMS, EQUIPITEMS, SPELLITEMS } from '../../teamContentCard/TeamContentCardData';

interface ActionItemProps {
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  clickedIndex: number;
  canAct: boolean;
  actionType: InventoryType;
  hideHotKey?: boolean;
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

handleOpenModal = (e: any, modalData: EQUIPMENT | CONSUMABLE | CHARACTER_INFO | SPELL, modalType: string) => {
    if (!modalData.name) return;
    const elementRect = e.currentTarget.getBoundingClientRect();

    const modalPosition = {
        top: elementRect.top + elementRect.height / 2,
        left: elementRect.left + elementRect.width / 2,
    };

    this.setState({openModal: true, modalType, modalPosition, modalData});
}

handleCloseModal = () => {
    this.setState({openModal: false});
}

  render() {
    const { action, index, clickedIndex, canAct, actionType, hideHotKey, onActionClick } = this.props;
    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === InventoryType.CONSUMABLES ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    const getActionItemData = (actionType: string, actionIndex: number) => {
      switch (actionType) {
        case ItemDialogType.CONSUMABLES:
          return CONSUMABLEITEMS[actionIndex];
        case ItemDialogType.EQUIPMENTS:
          return EQUIPITEMS[actionIndex];
        case ItemDialogType.SKILLS:
          return SPELLITEMS[actionIndex];
        default: return null;
      }
    }

    const handleOnClickAnction = (e: any) => {
      onActionClick(actionType, keyBinding, index);
      const item = getActionItemData(actionType, index);
      if (item && item.url) {
        this.handleOpenModal(e, item, actionType);
      }
    }

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    return (
      <div 
        className={`${actionType} ${index === clickedIndex ? 'flash-effect' : ''}`} 
        onClick={handleOnClickAnction}>
        {action.id > -1 && <div 
          className={!canAct ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
          style={{backgroundImage: `url(/${actionType}/${action.frame})`, cursor: 'pointer'}}
          />}
        {!hideHotKey && <span className="key-binding">{keyBinding}</span>}
        {/* {action.id > -1 && <div className="info-box box">
          <InfoBox action={action} />
        </div>} */}
        <ItemDialog dialogOpen={this.state.openModal} dialogType={this.state.modalType} position={this.state.modalPosition} dialogData={this.state.modalData} handleClose={this.handleCloseModal} />
      </div>
    );
  }
}

export default Action;