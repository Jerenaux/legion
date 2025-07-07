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
import Spinner from '../spinner/Spinner';

import { Link } from 'preact-router';
import Modal from 'react-modal';
import { Effect } from '@legion/shared/interfaces';

import shopIcon from '@assets/inventory/shop_btn.png';
import confirmIcon from '@assets/inventory/confirm_icon.png';
import cancelIcon from '@assets/inventory/cancel_icon.png';
import goldIcon from '@assets/gold_icon.png';
import { LockedFeatures } from '@legion/shared/enums';

import { INVENTORY_SLOT_PRICE } from '@legion/shared/config';
import { successToast, errorToast } from '../utils';

Modal.setAppElement('#root');
interface InventoryProps {
  handleItemEffect: (effects: Effect[], actionType: InventoryActionType, index?: number) => void;
  handleSelectedEquipmentSlot: (newValue: number) => void;
}

class Inventory extends Component<InventoryProps> {
  static contextType = PlayerContext; 

  state = {
    openModal: false,
    showPurchaseDialog: false,
    slotsQuantity: 1,
    isPurchasing: false
  }

  capacity = 50;

  handleOpenModal = () => {
    this.setState({ openModal: true });
  }

  handleCloseModal = () => {
    this.setState({ openModal: false });
  }

  handleOpenPurchaseDialog = () => {
    console.log('handleOpenPurchaseDialog');
    console.log('Current state before:', this.state);
    this.setState({ 
      showPurchaseDialog: true,
      slotsQuantity: 1 
    }, () => {
      console.log('State after update:', this.state);
    });
  }

  handleClosePurchaseDialog = () => {
    this.setState({ 
      showPurchaseDialog: false,
      slotsQuantity: 1 
    });
  }

  handleQuantityChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value) || 1;
    const maxAffordable = Math.floor(this.context.player.gold / INVENTORY_SLOT_PRICE);
    const clampedValue = Math.max(1, Math.min(value, Math.max(1, maxAffordable)));
    this.setState({ slotsQuantity: clampedValue });
  }

  handleConfirmPurchase = async () => {
    this.setState({ isPurchasing: true });
    
    try {
      await this.context.buyInventorySlots(this.state.slotsQuantity);
      successToast(`Successfully purchased ${this.state.slotsQuantity} inventory slot${this.state.slotsQuantity > 1 ? 's' : ''}!`);
      this.handleClosePurchaseDialog();
    } catch (error) {
      console.error('Error purchasing inventory slots:', error);
      errorToast('Failed to purchase inventory slots. Please try again.');
    } finally {
      this.setState({ isPurchasing: false });
    }
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
              {(() => {
                console.log('Rendering inventory categories. Feature accessible:', this.context.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1));
                console.log('Player gold:', this.context.player.gold);
                console.log('Slot price:', INVENTORY_SLOT_PRICE);
                console.log('Is purchasing:', this.state.isPurchasing);
                console.log('Button disabled?', this.context.player.gold < INVENTORY_SLOT_PRICE);
                return this.context.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1);
              })() && (
                <>
                  <Link href='/shop' className="categoryBtn" style={{ backgroundImage: `url(${shopIcon})` }}></Link>
                  <div className="categoryCount">
                    <span>{inventorySize(this.context.player.inventory)} </span>
                    &nbsp;/&nbsp;{this.context.player.carrying_capacity}
                  </div>
                  {this.state.isPurchasing ? (
                    <div className="info-bar-plus-loading">
                      <Spinner />
                    </div>
                  ) : (
                    <button 
                      className="info-bar-plus"
                      onClick={(e) => {
                        console.log('Button clicked!', e);
                        this.handleOpenPurchaseDialog();
                      }}
                      disabled={this.context.player.gold < INVENTORY_SLOT_PRICE}
                    ></button>
                  )}
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
        {/* Purchase Inventory Slots Dialog */}
        {(() => {
          console.log('Modal render check - showPurchaseDialog:', this.state.showPurchaseDialog);
          return null;
        })()}
        <Modal 
          isOpen={this.state.showPurchaseDialog} 
          onRequestClose={this.handleClosePurchaseDialog}
          style={{
            content: {
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              marginRight: '-50%',
              transform: 'translate(-50%, -50%)',
              padding: 0,
              border: 'none',
              background: 'transparent',
              overflow: 'visible'
            },
            overlay: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
            }
          }}
        >
          <div className="purchase-dialog-container">
            <h3 className="purchase-dialog-heading">Buy Inventory Slots</h3>
            
            <div className="purchase-dialog-content">
              <div className="quantity-selector">
                <label htmlFor="slot-quantity">Number of slots:</label>
                <input 
                  id="slot-quantity"
                  type="number" 
                  min="1" 
                  max={Math.max(1, Math.floor(this.context.player.gold / INVENTORY_SLOT_PRICE))}
                  value={this.state.slotsQuantity}
                  onChange={this.handleQuantityChange}
                  disabled={this.state.isPurchasing}
                  className="quantity-input"
                />
              </div>
              
              <div className="price-display">
                <div className="price-breakdown">
                  <span>Price per slot:</span>
                  <span className="price-value">
                    <img src={goldIcon} alt="gold" className="gold-icon" />
                    {INVENTORY_SLOT_PRICE}
                  </span>
                </div>
                <div className="price-total">
                  <span>Total cost:</span>
                  <span className="price-value total">
                    <img src={goldIcon} alt="gold" className="gold-icon" />
                    {this.state.slotsQuantity * INVENTORY_SLOT_PRICE}
                  </span>
                </div>
                <div className="remaining-gold">
                  <span>Remaining gold:</span>
                  <span className={`price-value ${(this.context.player.gold - (this.state.slotsQuantity * INVENTORY_SLOT_PRICE)) < 0 ? 'insufficient' : ''}`}>
                    <img src={goldIcon} alt="gold" className="gold-icon" />
                    {this.context.player.gold - (this.state.slotsQuantity * INVENTORY_SLOT_PRICE)}
                  </span>
                </div>
              </div>
            </div>

            <div className="purchase-dialog-buttons">
              {this.state.isPurchasing ? (
                <div className="purchase-loading">
                  <Spinner />
                  <span>Purchasing...</span>
                </div>
              ) : (
                <>
                  <button 
                    className="purchase-dialog-cancel" 
                    onClick={this.handleClosePurchaseDialog}
                  >
                    <img src={cancelIcon} alt="cancel" />
                    Cancel
                  </button>
                  <button 
                    className="purchase-dialog-confirm" 
                    onClick={this.handleConfirmPurchase}
                    disabled={this.context.player.gold < (this.state.slotsQuantity * INVENTORY_SLOT_PRICE)}
                  >
                    <img src={confirmIcon} alt="confirm" />
                    Purchase
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>

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