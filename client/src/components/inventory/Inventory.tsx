
// Inventory.tsx
import { h, Component } from 'preact';
import './Inventory.style.css';
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { getEquipmentById } from '@legion/shared/Equipments';
import ItemIcon from '../itemIcon/ItemIcon';
import { InventoryActionType, InventoryType, RarityColor } from '@legion/shared/enums';

import Skeleton from 'react-loading-skeleton';

import { Link } from 'preact-router';
import Modal from 'react-modal';
import { Effect, PlayerInventory } from '@legion/shared/interfaces';

Modal.setAppElement('#root');
interface InventoryProps {
  id: string;
  name: string;
  level: number;
  class: number;
  inventory: PlayerInventory;
  carrying_capacity: number;
  refreshCharacter: () => void;
  handleItemEffect: (effects: Effect[], actionType: InventoryActionType, index?: number) => void;
  updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
  handleSelectedEquipmentSlot: (newValue: number) => void;
  setInventoryData: boolean;
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

    const activeInventory = this.props.inventory[this.state.actionType];
    const isCategoryEmpty = !activeInventory || !activeInventory?.length;

    const getItem = (itemID: number) => {
      switch (this.state.actionType) {
        case InventoryType.CONSUMABLES:
          return getConsumableById(itemID);
        case InventoryType.SKILLS:
          return getSpellById(itemID);
        case InventoryType.EQUIPMENTS:
          return getEquipmentById(itemID);
        default:
          return null;
      }
    }

    const slots = activeInventory?.map((itemId: number, i: number) => {
      const item = getItem(itemId);

      const slotStyle = {
        backgroundImage: `linear-gradient(to bottom right, ${RarityColor[item?.rarity]}, #1c1f25)`
      }

      // console.log("InventoryProps => ", this.props); 

      return <div key={i} className="item" style={slotStyle}>
        <ItemIcon
          characterId={this.props.id}
          characterName={this.props.name}
          characterLevel={this.props.level}
          characterClass={this.props.class}
          action={item}
          index={i}
          hideHotKey={true}
          actionType={this.state.actionType}
          refreshCharacter={this.props.refreshCharacter}
          handleItemEffect={this.props.handleItemEffect}
          updateInventory={this.props.updateInventory}
          handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot}
        />

        {/* {this.props.id != '' ? (
          <ItemIcon
            characterId={this.props.id}
            characterName={this.props.name}
            characterLevel={this.props.level}
            characterClass={this.props.class}
            action={item}
            index={i}
            hideHotKey={true}
            actionType={this.state.actionType}
            refreshCharacter={this.props.refreshCharacter}
            handleItemEffect={this.props.handleItemEffect}
            updateInventory={this.props.updateInventory}
            handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot}
          />
        ) : (
          <Skeleton height={48} count={1} highlightColor='#0000004d' baseColor='#0f1421' style={{ margin: '0 12px 0 16px', width: '48px' }} />
        )} */}

      </div>
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
              <div className="inventoryCategory" style={this.state.actionType === InventoryType.SKILLS && currCategoryStyle} onClick={() => this.handleActionType(InventoryType.SKILLS)}>SPELLS</div>
              <div className="categoryCount"><span>{this.inventoryLength()} </span>&nbsp;/&nbsp;{this.props.carrying_capacity}</div>
              <div className="categoryBtn" style={{ backgroundImage: 'url(./inventory/info_btn.png)' }} onClick={this.handleOpenModal}></div>
            </div>
          </div>
          <div className="inventoryWrapper">
            {
              !this.props.setInventoryData ?
                <div style={{ display: "flex", gap: '6px' }}>
                  {[...Array(6)].map((_, index) => (
                    <Skeleton
                      key={index}
                      height={48}
                      highlightColor="#0000004d"
                      baseColor="#0f1421"
                      style={{
                        width: '48px',
                      }}
                    />
                  ))}
                </div> :
                isCategoryEmpty ?
                  <div className='empty-slots-container'>
                    <p>No items in this category, take a look at the shop!</p>
                    <Link href='/shop'>Go to shop <img src="./inventory/shop_btn.png" alt="shop" /></Link>
                  </div> :
                slots
            }
            {/* {isCategoryEmpty ? (<div className='empty-slots-container'>
              <p>No items in this category, take a look at the shop!</p>
              <Link href='/shop'>Go to shop <img src="./inventory/shop_btn.png" alt="shop" /></Link>
            </div>) : slots} */}
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