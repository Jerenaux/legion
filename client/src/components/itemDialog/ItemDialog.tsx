// ItemDialog.tsx
import './ItemDialog.style.css';
import Modal from 'react-modal';
import { h, Component } from 'preact';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from './ItemDialogType';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { InventoryActionType, Stat, Target, Class } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';
import { errorToast, successToast, mapFrameToCoordinates, classEnumToString } from '../utils';
import { getEquipmentById } from '@legion/shared/Equipments';

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
  dialogData: BaseItem | BaseSpell | BaseEquipment | CHARACTER_INFO | null;
  position: {
    top: number,
    left: number
  };
  handleClose: () => void;
  refreshCharacter?: () => void;
  updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
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
    console.log("AcceptType => ", type);
    console.log("AcceptIndex => ", index);

    if (!this.props.characterId) return;

    const payload = {
      index,
      characterId: this.props.characterId,
      inventoryType: type,
      action: this.props.actionType
    };

    // console.log("before update inventory"); 

    if (this.props.updateInventory) this.props.updateInventory(type, this.props.actionType, index)
    this.props.handleClose();

    // console.log("after update inventory"); 

    apiFetch('inventoryTransaction', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          // successToast(this.props.actionType > 0 ? 'Item un-equipped!' : 'Item equipped!');

          // console.log("propsData => ", this.props); 
          this.props.refreshCharacter();
          // } else {
          //   errorToast('Character inventory is full!');
        }
      })
      .catch(error => errorToast(`Error: ${error}`));
  }

  spendSP = (index: number) => {
    if (!this.props.characterId) return;

    // console.log("itemDialogPropsData => ", this.props); 
    // console.log("spendSPCharacterId => ", this.props.characterId); 

    const payload = {
      index,
      characterId: this.props.characterId,
    };

    this.props.handleClose();

    apiFetch('spendSP', {
      method: 'POST',
      body: payload
    })
      .then((data) => {
        if (data.status == 0) {
          successToast('SP spent!');

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
    // console.log("characterName => ", this.props.characterName); 

    const { dialogType, dialogData, position, dialogOpen, isEquipped, handleClose } = this.props;

    const acceptBtn = this.props.actionType > 0 ? 'Remove' : 'Equip';

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

    const getInfoVal = (val: string) => {
      if (val === undefined) return '+1';
      return Number(val) < 0 ? Number(val) + 1 : `+${Number(val) + 1}`;
    };

    const equipmentDialog = (dialogData: BaseEquipment) => {
      if (!dialogData) return null;

      // console.log("equipDialogData => ", dialogData);

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 5;
      coordinates.y = -coordinates.y + 5;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;

      const equipment = this.state.inventory.equipment;
      const equipmentData = getEquipmentById(equipment[this.props.index]);

      // console.log("equipmentEquipment => ", equipment); 
      // console.log("equipmentData => ", equipmentData); 
      // console.log("itemDialogClass => ", this.props.characterClass); 
      // console.log("itemDialogIncludes => ", equipmentData.classes.includes(this.props.characterClass)); 

      return (
        <div className="equip-dialog-container">
          <div className="equip-dialog-image" style={{
            backgroundImage: `url(equipment.png)`,
            backgroundPosition,
          }} />
          <p className="equip-dialog-name">{dialogData.name}</p>
          <div style={this.props.characterLevel >= dialogData.minLevel ? { backgroundColor: "#2f404d" } : { backgroundColor: "darkred" }} className="equip-dialog-lvl">
            LV <span>{dialogData.minLevel}</span>
          </div>
          <div className="equip-dialog-class-container">
            {equipmentData.classes?.map((item) =>
              <div className="equip-dialog-class">
                {classEnumToString(item)}
              </div>
            )}
          </div>
          {dialogData.description && <p className="equip-dialog-desc">{dialogData.description}</p>}
          <div className="dialog-button-container">
            <button
              style={(this.props.characterLevel < dialogData.minLevel || (equipmentData.classes.length > 0 && !equipmentData.classes.includes(this.props.characterClass))) ? { backgroundColor: "grey", opacity: "0.5" } : {}}
              className="dialog-accept"
              disabled={(this.props.characterLevel < dialogData.minLevel || (equipmentData.classes.length > 0 && !equipmentData.classes.includes(this.props.characterClass)))}
              onClick={() => this.AcceptAction(dialogType, this.props.index)}
            >
              <img src="/inventory/confirm_icon.png" alt="confirm" />
              {acceptBtn}
            </button>
            <button className="dialog-decline" onClick={handleClose}>
              <img src="/inventory/cancel_icon.png" alt="decline" />
              Cancel
            </button>
          </div>
        </div>
      );
    };

    const consumableDialog = (dialogData: BaseItem) => {
      if (!dialogData) return;

      // console.log("dialogData => ", dialogData); 

      const coordinates = mapFrameToCoordinates(dialogData.frame);
      coordinates.x = -coordinates.x + 5;
      coordinates.y = -coordinates.y + 5;
      const backgroundPosition = `${coordinates.x}px ${coordinates.y}px`;
      return (
        <div className="dialog-item-container">
          <div className="dialog-item-heading-bg"></div>
          <div className="dialog-item-heading">
            <div className="dialog-item-heading-image" style={{
              backgroundImage: `url(consumables.png)`,
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
              <img src={'/inventory/cd_icon.png'} alt="cd" />
              <span>{dialogData.cooldown}s</span>
            </div>
            <div className="dialog-consumable-info">
              <img src={'/inventory/target_icon.png'} alt="target" />
              <span>{Target[dialogData.target]}</span>
            </div>
          </div>
          <div className="dialog-item-info-container">
            {
              dialogData.effects.map(effect =>
                <div className="dialog-item-info">
                  <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[Stat[effect.stat]] }}><span>{Stat[effect.stat]}</span></div>
                  <span style={effect.value > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{effect.value > 0 ? `+${effect.value}` : effect.value}</span>
                </div>
              )
            }
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => this.AcceptAction(dialogType, this.props.index)}><img src="/inventory/confirm_icon.png" alt="confirm" />{acceptBtn}</button>
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
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
              backgroundImage: `url(spells.png)`,
              backgroundPosition,
            }} />
          </div>
          <p className="dialog-spell-name">{dialogData.name}</p>
          <p className="dialog-spell-desc">{dialogData.description}</p>
          <div className="dialog-spell-info-container">
            <div className="dialog-spell-info">
              <img src={'/inventory/mp_icon.png'} alt="mp" />
              <span>{dialogData.cost}</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/cd_icon.png'} alt="cd" />
              <span>{dialogData.cooldown}s</span>
            </div>
            <div className="dialog-spell-info">
              <img src={'/inventory/target_icon.png'} alt="target" />
              <span>{Target[dialogData.target]}</span>
            </div>
          </div>
          <div className="dialog-button-container">
            {!isEquipped && <button className="dialog-accept" onClick={() => this.setState({ dialogSpellModalShow: true })}><img src="/inventory/confirm_icon.png" alt="confirm" />{acceptBtn}</button>}
            <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
          </div>
          <div style={this.state.dialogSpellModalShow ? { display: 'block' } : { display: 'none' }} class="dialog-spell-modal">
            <div className="dialog-spell-modal-text">
              Are you sure you want to teach {dialogData.name} to {this.props.characterName}?
            </div>
            <div className="dialog-button-container">
              <button className="dialog-accept" onClick={() => { this.AcceptAction(dialogType, this.props.index); this.setState({ dialogSpellModalShow: false }); }}><img src="/inventory/confirm_icon.png" alt="confirm" />Confirm</button>
              <button className="dialog-decline" onClick={() => this.setState({ dialogSpellModalShow: false })}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
            </div>
          </div>
        </div>
      )
    };

    const characterInfoDialog = (dialogData: CHARACTER_INFO) => (
      <div className="character-info-dialog-container">
        <div className="character-info-dialog-card-container">
          <div className="character-info-dialog-card" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[dialogData.key]] }}><span>{INFO_TYPE[dialogData.key]}</span></div>
          <div className="character-info-dialog-card-text">
            {dialogData.value}
            {/* <span className='character-info-addition' style={dialogData.effect && Number(dialogData.effect) < 0 ? { color: '#c95a74' } : { color: '#9ed94c' }}>{getInfoVal(dialogData.effect)}</span>  */}
            <span className='character-info-addition' style={dialogData.effect && Number(dialogData.effect) < 0 ? { color: '#c95a74' } : { color: '#9ed94c' }}>+{this.state.dialogValue}</span>
          </div>
        </div>
        <div className="character-info-dialog-control">
          <div className="character-info-dialog-control-btn" onClick={decrementValue}>-</div>
          <div className="character-info-dialog-control-val">{this.state.dialogValue}</div>
          <div className="character-info-dialog-control-btn" onClick={incrementValue}>+</div>
        </div>
        <div className="dialog-button-container">
          <button className="dialog-accept" onClick={() => this.setState({ dialogSPModalShow: true })}><img src="/inventory/confirm_icon.png" alt="confirm" />Accept</button>
          <button className="dialog-decline" onClick={handleClose}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
        </div>

        <div style={this.state.dialogSPModalShow ? { display: 'block' } : { display: 'none' }} class="dialog-spell-modal dialog-SP-modal">
          <div className="dialog-spell-modal-text">
            Are you sure you want to spend {this.state.dialogValue} SP?
          </div>
          <div className="dialog-button-container">
            <button className="dialog-accept" onClick={() => { this.spendSP(0); this.setState({ dialogSPModalShow: false }); }}><img src="/inventory/confirm_icon.png" alt="confirm" />Confirm</button>
            <button className="dialog-decline" onClick={() => this.setState({ dialogSPModalShow: false })}><img src="/inventory/cancel_icon.png" alt="decline" />Cancel</button>
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
        case ItemDialogType.CHARACTER_INFO:
          return characterInfoDialog(dialogData as CHARACTER_INFO);
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