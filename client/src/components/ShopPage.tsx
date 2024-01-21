// ShopPage.tsx
import { h, Component } from 'preact';
import Description from './Description';
import { items } from '@legion/shared/Items';
import toast from '@brenoroosevelt/toast'
import { apiFetch } from '../services/apiService';
import { classEnumToString, statStrings } from './utils';
import ActionItem from './game/HUD/Action';
import { spells } from '@legion/shared/Spells';
import { ActionType } from './game/HUD/ActionTypes';

interface State {
  gold: number;
  inventory: Array<any>;
  items: Array<any>;
  characters: Array<any>;
  isDialogOpen: boolean;
  selectedItem: any;
  quantity: number;
}

class ShopPage extends Component<object, State> {

  state: State = {
    gold: 0,
    inventory: [],
    items,
    characters: [],
    isDialogOpen: false,
    selectedItem: null,
    quantity: 1,
  };

  componentDidMount() {
    this.fetchInventoryData(); 
    this.fetchCharactersOnSale();
  }

  async fetchInventoryData() {
    try {
        const data = await apiFetch('inventoryData');
        console.log(data);
        this.setState({ 
            gold: data.gold,
            inventory: data.inventory
        });
    } catch (error) {
        toast.error(`Error: ${error}`, {closeBtn: true, position: 'top'});
    }
  }

  async fetchCharactersOnSale() {
    try {
        const data = await apiFetch('listOnSaleCharacters');
        console.log(data);
        this.setState({ 
            characters: data
        });
    } catch (error) {
        toast.error(`Error: ${error}`, {closeBtn: true, position: 'top'});
    }
  }

  getAmountOwned = (itemId) => {
    return this.state.inventory.filter((item) => item === itemId).length;
  }

  openDialog = (item) => {
    this.setState({ isDialogOpen: true, selectedItem: item, quantity: 1 });
  }

  closeDialog = () => {
    this.setState({ isDialogOpen: false, selectedItem: null });
  }

  changeQuantity = (amount) => {
    this.setState((prevState) => {
      // Ensure quantity does not go below 1
      const newQuantity = prevState.quantity + amount;
      return { 
        quantity: newQuantity >= 1 ? newQuantity : 1 
      };
    });
  }

  hasEnoughGold = (itemId, quantity) => {
    const item = this.state.items.find((item) => item.id === itemId);
    if (!item) {
      return false;
    }

    return this.state.gold >= item.price * quantity;
  }

  purchaseItem = () => {
    const { selectedItem, quantity } = this.state;
    if (!selectedItem) {
      return;
    }
    if (!this.hasEnoughGold(selectedItem.id, quantity)) {
      toast.error('Not enough gold!', {closeBtn: false, position: 'top', duration: 3000});
      return;
    }

    const payload = {
        itemId: selectedItem.id,
        quantity,
    };
    
    apiFetch('purchaseItem', {
        method: 'POST',
        body: payload
    })
    .then(data => {
        console.log(data);
        this.setState({ 
            gold: data.gold,
            inventory: data.inventory
        });
        toast.success('Purchase successful!', {closeBtn: false, position: 'top', duration: 3000});
    })
    .catch(error => toast.error(`Error: ${error}`, {closeBtn: true, position: 'top'}));
    
    this.closeDialog();
  }

  render() {
    const { isDialogOpen, selectedItem, quantity } = this.state;
    const totalPrice = selectedItem ? selectedItem.price * quantity : 0;
    return (
        <div className="shop-content">
            <div className="shop-grid">
              {this.state.items.map((item) => (
                <div key={item.id} className="shop-item-card" onClick={() => this.openDialog(item)}>
                  <div className="shop-item-card-header">
                    <div className="shop-item-card-name">{item.name}</div>
                    <div className="shop-item-card-name-shadow">{item.name}</div>
                  </div>
                  <div className="shop-item-card-content">
                    <div style={{ backgroundImage: `url(/assets/items/${item.frame})` }} className="shop-item-image" />
                    <div className="shop-item-card-content-info">
                      <div className="shop-item-details">
                        {item.description}
                        <Description action={item} />
                      </div>
                      <div className="shop-item-card-capsules">
                        <div className="shop-item-card-owned" title='Amount Owned'>{this.getAmountOwned(item.id)}</div>
                        <div className="shop-item-card-price" title='Price'>{item.price}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="shop-grid">
              {this.state.characters && this.state.characters.map((character) => (
                <div key={character.id} className="character-full">
                  <div className="character-header">
                      <div className="character-header-name">{character.name}</div>
                      <div className="character-header-name-shadow">{character.name}</div>
                      <div className={`character-header-class`}>{classEnumToString(character.class)}</div>
                  </div>
                  <div className="character-full-content">
                      <div className="character-full-stats">
                        <div className="level-area">
                            <div className="level-badge">
                                <span>lvl</span>
                                <span className="level-number">{character.level}</span>
                            </div>
                        </div>
                        <div className="stats-area">
                          {statStrings.map((stat) => (
                            <div key={stat} className={`badge ${stat}`}>
                              <span className="badge-label">{stat.toUpperCase()}</span> 
                              <span>{this.state[stat]}</span>
                            </div>
                          ))}
                        </div>
                        <div className="character-full-actions">
                          {character.skills.length > 0 && <div className="player-skills">
                            <div className='slots-header'>Skills</div>
                            <div className="slots">
                            {character.skills.map((spell, i) => (
                              <ActionItem 
                                action={spell > -1 ? spells[spell] : null} 
                                index={i} 
                                clickedIndex={-1}
                                canAct={true} 
                                actionType={ActionType.Skill}
                                key={i}
                              />
                            ))}
                            </div>
                          </div>}
                        </div>
                      </div>
                      <div className="character-portrait" style={{backgroundImage: `url(/assets/sprites/${character.portrait}.png)`}} />
                  </div>
                </div>
              ))}
            </div>

        {isDialogOpen && (
          <div className="dialog">
            <div className="shop-item-card-header">
              <div className="shop-item-card-name">Buy</div>
              <div className="shop-item-card-name-shadow">Buy</div>
            </div>
            <div className="shop-item-card-content">
            <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeDialog} />
              <div className="purchase-dialog">
                <div className="purchase-item">
                  <span className="purchase-item-name">{selectedItem.name} x</span>
                  <div className="purchase-quantity-selector">
                    <button className="purchase-adjust purchase-minus" onClick={() => this.changeQuantity(-1)}>-</button>
                    <input type="text" className="purchase-quantity" value={quantity} />
                    <button className="purchase-adjust  purchase-plus" onClick={() => this.changeQuantity(1)}>+</button>
                  </div>
                </div>
                <div className="purchase-total">
                  <span>Total: {totalPrice}G</span>
                </div>
                <button className="purchase-buy-button" onClick={this.purchaseItem}>BUY</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ShopPage;