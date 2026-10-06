import { h } from 'preact';
import './HUD.style.css';
import { Component } from 'preact';
import { InventoryType, ItemDialogType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { mapFrameToCoordinates } from '../utils';
import { cropFrame } from '../utils';

import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

interface ItemIconProps {
  characterId?: string,
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  canAct: boolean;
  actionType: InventoryType;
  /** Key shown in the corner; empty when the slot has no key. */
  keyLabel: string;
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
    croppedImageUrl: null,
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

  render() {
    const { action, canAct, actionType } = this.props;
    const { croppedImageUrl } = this.state;

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    return (
      <div className="player_bar_action_art" aria-hidden="true">
        {action.id > -1 && (
          <div
            className={!canAct ? 'player_bar_item-icon player_bar_item-icon-off' : 'player_bar_item-icon player_bar_item-icon-pointer'}
            style={{
              backgroundImage: croppedImageUrl ? `url(${croppedImageUrl})` : 'none',
            }}
          />
        )}
        {this.props.keyLabel && <span className="player_bar_key-binding">{this.props.keyLabel}</span>}
      </div>
    );
  }
}

export default ItemIcon;
