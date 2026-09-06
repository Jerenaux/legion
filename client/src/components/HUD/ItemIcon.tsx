import { h } from 'preact';
import './HUD.style.css';
import { Component } from 'preact';
import { InventoryType, ItemDialogType } from '@legion/shared/enums';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { mapFrameToCoordinates } from '../utils';
import { cropFrame } from '../utils';
import { events } from '../HUD/GameHUD';
import {loadGameSettings} from '../../settings';

import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

interface ItemIconProps {
  characterId?: string,
  action: BaseItem | BaseSpell | BaseEquipment | null;
  index: number;
  canAct: boolean;
  actionType: InventoryType;
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
  keyboardLayout: number; // 0 for AZERTY, 1 for QWERTY
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
    keyboardLayout: 0
  }

  componentDidMount() {
    this.cropSpritesheet();
    this.loadKeyboardLayout();
    events.on('settingsChanged', this.handleSettingsChanged);
  }

  componentDidUpdate(prevProps: ItemIconProps) {
    if (prevProps.action !== this.props.action) {
      this.cropSpritesheet();
    }
  }

  componentWillUnmount() {
    events.off('settingsChanged', this.handleSettingsChanged);
  }

  handleSettingsChanged = (settings) => {
    this.setState({ keyboardLayout: settings.keyboardLayout });
  }

  loadKeyboardLayout = () => {
    this.setState({ keyboardLayout: loadGameSettings().keyboardLayout });
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

  getKeyBinding = () => {
    const { index, actionType } = this.props;
    const { keyboardLayout } = this.state;

    const qwertyLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const azertyLayout = 'AZERTYUIOPQSDFGHJKLMWXCVBN';

    const layout = keyboardLayout === 0 ? azertyLayout : qwertyLayout;

    let startPosition: number;
    if (actionType === InventoryType.CONSUMABLES) {
      startPosition = keyboardLayout === 0 ? layout.indexOf('W') : layout.indexOf('Z');
    } else { // For spells
      startPosition = keyboardLayout === 0 ? layout.indexOf('A') : layout.indexOf('Q');
    }

    return layout.charAt(startPosition + index);
  }

  render() {
    const { action, canAct, actionType } = this.props;
    const { croppedImageUrl } = this.state;

    if (!action) {
      return <div className={`${actionType}`} />;
    }

    return (
      <div>
        {action.id > -1 && (
          <div
            className={!canAct ? 'item-icon item-icon-off' : 'item-icon item-icon-pointer'}
            style={{
              backgroundImage: croppedImageUrl ? `url(${croppedImageUrl})` : 'none',
              backgroundSize: 'cover',
            }}
          />
        )}
        <span className="key-binding">{this.getKeyBinding()}</span>
      </div>
    );
  }
}

export default ItemIcon;
