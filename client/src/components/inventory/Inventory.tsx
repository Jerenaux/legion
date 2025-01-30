// Inventory.tsx
import { h, Fragment, Component } from 'preact';
import './Inventory.style.css';
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { getEquipmentById } from '@legion/shared/Equipments';
import ItemIcon from '../itemIcon/ItemIcon';
import { InventoryActionType, InventoryType, RarityColor } from '@legion/shared/enums';
import { PlayerContext } from '../../contexts/PlayerContext';
import { inventorySize } from '@legion/shared/utils';

import Skeleton from 'react-loading-skeleton';

import { Link } from 'preact-router';
import Modal from 'react-modal';
import { Effect } from '@legion/shared/interfaces';

import shopIcon from '@assets/inventory/shop_btn.png';
import { LockedFeatures } from '@legion/shared/enums';


Modal.setAppElement('#root');
interface InventoryProps {
  handleItemEffect: (effects: Effect[], actionType: InventoryActionType, index?: number) => void;
  handleSelectedEquipmentSlot: (newValue: number) => void;
}

class Inventory extends Component<InventoryProps> {
  static contextType = PlayerContext; 

  state = {
    openModal: false
  }

  capacity = 50;

  handleOpenModal = () => {
    this.setState({ openModal: true });
  }

  handleCloseModal = () => {
    this.setState({ openModal: false });
  }

  render() {
    const renderInventorySection = (type: InventoryType, label: string) => {
      const inventory = this.context.player.inventory[type];
      if (!inventory?.length) return null;

      const getItem = (itemID: number) => {
        switch (type) {
          case InventoryType.CONSUMABLES:
            return getConsumableById(itemID);
          case InventoryType.SPELLS:
            return getSpellById(itemID);
          case InventoryType.EQUIPMENTS:
            return getEquipmentById(itemID);
          default:
            return null;
        }
      }

      return (
        <div className="inventory-section">
          <h3 className="section-title">{label}</h3>
          <div className="section-items">
            {inventory.map((itemId: number, i: number) => {
              const item = getItem(itemId);
              const slotStyle = {
                backgroundImage: `linear-gradient(to bottom right, ${RarityColor[item?.rarity]}, #1c1f25)`
              }

              return (
                <div 
                  key={i} 
                  className="item" 
                  style={slotStyle}
                  data-item-icon={`${type}-${item?.id}`}
                >
                  <ItemIcon
                    action={item}
                    index={i}
                    hideHotKey={true}
                    actionType={type}
                    handleItemEffect={this.props.handleItemEffect}
                    handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="inventoryFullContainer">
        <div className="inventoryContainer">
          <div className="inventoryCategoryContainer">
            <p className="inventoryLabel">INVENTORY</p>
            <div className="inventoryCategories">
              {this.context.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) && (
                <>
                  <Link href='/shop' className="categoryBtn" style={{ backgroundImage: `url(${shopIcon})` }}></Link>
                  <div className="categoryCount">
                    <span>{inventorySize(this.context.player.inventory)} </span>
                    &nbsp;/&nbsp;{this.context.player.carrying_capacity}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="inventoryWrapper">
            {!this.context.player.isLoaded ? (
              <div style={{ position: "absolute", display: "flex", gap: '6px' }}>
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
              </div>
            ) : (
              <div className="inventory-sections">
                {renderInventorySection(InventoryType.CONSUMABLES, "CONSUMABLES")}
                {renderInventorySection(InventoryType.EQUIPMENTS, "EQUIPMENT")}
                {renderInventorySection(InventoryType.SPELLS, "SPELLS")}
                {!Object.values(InventoryType).some(type => 
                  this.context.player.inventory[type]?.length > 0
                ) && (
                  <div className='empty-slots-container'>
                    <p>Your inventory is empty{this.context.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) ? ', take a look at the shop!' : '!'}</p>
                    {this.context.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) && (
                      <Link href='/shop'>Go to shop <img src={shopIcon} alt="shop" /></Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Modal isOpen={this.state.openModal}  onRequestClose={this.handleCloseModal}>
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