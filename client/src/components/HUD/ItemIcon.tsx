import './HUD.style.css';
import { h, Component } from 'preact';
import { InventoryType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { ItemDialogType } from '../itemDialog/ItemDialogType';
import { mapFrameToCoordinates } from '../utils';

import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

interface ItemIconProps {
  characterId?: string,
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  canAct: boolean;
  actionType: InventoryType;
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

  render() {
    const { action, index, canAct, actionType } = this.props; 

    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === InventoryType.CONSUMABLES ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    const spriteSheetsMap = {
      [InventoryType.CONSUMABLES]: consumablesSpritesheet,
      [InventoryType.SPELLS]: spellsSpritesheet,
    }
    const spritesheet = spriteSheetsMap[actionType];

    return (
      <div>
        {action.id > -1 && <div 
          className={!canAct ? 'item-icon item-icon-off' : 'item-icon item-icon-pointer'}
          style={{
            backgroundImage: `url(${spritesheet})`,
            backgroundPosition: `-${mapFrameToCoordinates(action.frame).x}px -${mapFrameToCoordinates(action.frame).y}px`,
          }}
          />}
        <span className="key-binding">{keyBinding}</span>
      </div>
    );
  }
}

export default ItemIcon;