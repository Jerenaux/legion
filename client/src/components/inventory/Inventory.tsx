
// Inventory.tsx
import { h, Component } from 'preact';
import './Inventory.style.css';
import { items } from '@legion/shared/Items';
import { spells } from '@legion/shared/Spells';
import { equipments } from '@legion/shared/Equipments';
import ActionItem from '../game/HUD/Action';
import { InventoryActionType, InventoryType, RarityColor } from '@legion/shared/enums';

import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';
import { Link, route } from 'preact-router';
import Modal from 'react-modal';
import { Effect } from '@legion/shared/interfaces';

Modal.setAppElement('#root');
interface InventoryProps {
  id: string;
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
  carrying_capacity: number;
  refreshCharacter: () => void;
  handleItemEffect: (effects: Effect[], actionType: InventoryActionType) => void;
}

class Inventory extends Component<InventoryProps> {
  state = {
    actionType: InventoryType.CONSUMABLES,
    openModal: false
  }

  capacity = 50;

  handleActionType = (actionType: string) => {
    this.setState({ actionType: actionType });
  }

  handleOpenModal = () => {
    this.setState({ openModal: true });
  }

  handleCloseModal = () => {
    this.setState({ openModal: false });
  }

  inventoryLength = () => Object.values(this.props.inventory)
    .filter(Array.isArray)
    .map(arr => arr.length)
    .reduce((acc, curr) => acc + curr, 0);

  render() {
    const isCategoryEmpty = !this.props.inventory[this.state.actionType] || !this.props.inventory[this.state.actionType]?.length;

    const getAction = (actionIndex: number) => {
      switch (this.state.actionType) {
        case InventoryType.CONSUMABLES:
          return items[this.props.inventory[InventoryType.CONSUMABLES][actionIndex]];
        case InventoryType.SKILLS:
          return spells[this.props.inventory[InventoryType.SKILLS][actionIndex]];
        case InventoryType.EQUIPMENTS:
          return equipments[this.props.inventory[InventoryType.EQUIPMENTS][actionIndex]];
        default: return null;
      }
    }

    const slots = Array.from({ length: this.props.carrying_capacity }, (_, i) => {
      if (i < this.props.inventory[this.state.actionType]?.length) {
        const actionItem = getAction(i);

        const slotStyle = {
          backgroundImage: `linear-gradient(to bottom right, ${RarityColor[actionItem?.rarity]}, #1c1f25)`
        }

        return <div key={i} className="item" style={slotStyle}>
          <ActionItem
            characterId={this.props.id}
            action={actionItem}
            index={i}
            clickedIndex={-1}
            canAct={true}
            hideHotKey={true}
            actionType={this.state.actionType}
            refreshCharacter={this.props.refreshCharacter}
            handleItemEffect={this.props.handleItemEffect}
          />
        </div>
      }
    });

    const currCategoryStyle = {
      backgroundColor: 'transparent',
      border: '1px solid #a5670f',
    }

    const customStyles = {
      content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
        padding: 0,
        border: 'none',
        background: 'transparent'
      },
      overlay: {
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
      }
    };

    return (
      <div className="inventoryFullContainer">
        <div className="inventoryContainer">
          <div className="inventoryCategoryContainer">
            <p className="inventoryLabel">INVENTORY</p>
            <div className="inventoryCategories">
              <Link href='/shop' className="categoryBtn" style={{ backgroundImage: 'url(./inventory/shop_btn.png)' }}></Link>
              <div className="inventoryCategory" style={this.state.actionType === InventoryType.CONSUMABLES && currCategoryStyle} onClick={() => this.handleActionType(InventoryType.CONSUMABLES)}>CONSUMABLES</div>
              <div className="inventoryCategory" style={this.state.actionType === InventoryType.EQUIPMENTS && currCategoryStyle} onClick={() => this.handleActionType(InventoryType.EQUIPMENTS)}>EQUIPMENT</div>
              <div className="inventoryCategory" style={this.state.actionType === InventoryType.SKILLS && currCategoryStyle} onClick={() => this.handleActionType(InventoryType.SKILLS)}>SKILLS</div>
              {/* <div className="inventoryCategory" style={this.state.actionType === InventoryType.UTILITIES && currCategoryStyle} onClick={() => this.handleActionType(InventoryType.UTILITIES)}>UTILITIES</div> */}
              <div className="categoryCount"><span>{this.inventoryLength()} </span>&nbsp;/&nbsp;50</div>
              <div className="categoryBtn" style={{ backgroundImage: 'url(./inventory/info_btn.png)' }} onClick={this.handleOpenModal}></div>
            </div>
          </div>
          <div className="inventoryWrapper">
            {isCategoryEmpty ? (<div className='empty-slots-container'>
              <p>No items in this category, take a look at the shop!</p>
              <Link href='/shop'>Next <img src="./inventory/shop_btn.png" alt="shop" /></Link>
            </div>) : slots}
          </div>
        </div>
        <Modal isOpen={this.state.openModal} style={customStyles} onRequestClose={this.handleCloseModal}>
          <div className="hint-modal-container">
            <p className="hint-modal-heading">Hint Modal</p>
            <div className="hint-modal-button-container">
              <button className="hint-modal-decline" onClick={this.handleCloseModal}>Close</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default Inventory;