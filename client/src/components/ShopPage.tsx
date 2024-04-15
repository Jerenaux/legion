import { h, Component } from 'preact';
import Description from './Description';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../services/apiService';
import { classEnumToString, statStrings } from './utils';
import ActionItem from './game/HUD/Action';
import { spells } from '@legion/shared/Spells';
import { InventoryType } from '@legion/shared/enums';
import { successToast, errorToast } from './utils';

const imageContext = require.context('@assets/consumables', false, /\.png$/);

const images = imageContext.keys().map(key => ({
  name: key,
  path: imageContext(key)
}));


enum DialogType {
  ITEM_PURCHASE,
  CHARACTER_PURCHASE,
  EQUIPMENT_PURCHASE,
  NONE // Represents no dialog open
}

interface State {
  gold: number;
  inventory: Array<any>;
  items: Array<any>;
  characters: Array<any>;
  openDialog: DialogType;
  selectedArticle: any;
  quantity: number;
}

class ShopPage extends Component<object, State> {

  state: State = {
    gold: 0,
    inventory: [],
    items,
    characters: [],
    openDialog: DialogType.NONE,
    selectedArticle: null,
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
        errorToast(`Error: ${error}`);
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
        errorToast(`Error: ${error}`);
    }
  }

  getAmountOwned = (itemId) => {
    // return this.state.inventory.filter((item) => item === itemId).length;
    return 0;
  }

  openDialog = (dialogType: DialogType, article: any = null) => {
    this.setState({ 
      openDialog: dialogType, 
      selectedArticle: article, 
      quantity: 1 
    });
  }

  closeDialog = () => {
    this.setState({ openDialog: DialogType.NONE, selectedArticle: null });
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

  hasEnoughGold = (articleId, quantity, isCharacterPurchase) => {
    const array = isCharacterPurchase ? this.state.characters : this.state.items;
    const article = array.find((article) => article.id === articleId);
    if (!article) {
      return false;
    }

    return this.state.gold >= article.price * quantity;
  }

  purchase = () => {
    const { selectedArticle, quantity } = this.state;
    const isCharacterPurchase = this.state.openDialog === DialogType.CHARACTER_PURCHASE;

    if (!selectedArticle) {
      errorToast('No article selected!');
      return;
    }
    if (!this.hasEnoughGold(selectedArticle.id, quantity, isCharacterPurchase)) {
      errorToast('Not enough gold!');
      return;
    }

    const payload = {
        articleId: selectedArticle.id,
        quantity,
    };
    console.log(payload);

    const endpoint = isCharacterPurchase ? 'purchaseCharacter' : 'purchaseItem';
    
    apiFetch(endpoint, {
        method: 'POST',
        body: payload
    })
    .then(data => {
        console.log(data);
        this.fetchInventoryData(); 
        if (isCharacterPurchase) {
          this.fetchCharactersOnSale();
        }
        successToast('Purchase successful!');
    })
    .catch(error => errorToast(`Error: ${error}`));
    
    this.closeDialog();
  }

  render() {
    const { openDialog, selectedArticle, quantity } = this.state;
    const totalPrice = selectedArticle ? selectedArticle.price * quantity : 0;
    return (
        <div className="shop-content">
            <div className="shop-grid">
              {this.state.items.map((item) => (
                <div key={item.id} className="shop-item-card" onClick={() => this.openDialog(DialogType.ITEM_PURCHASE, item)}>
                  <div className="shop-item-card-header">
                    <div className="shop-item-card-name">{item.name}</div>
                    <div className="shop-item-card-name-shadow">{item.name}</div>
                  </div>
                  <div className="shop-item-card-content">
                    <div style={{ backgroundImage: `url(/items/${item.frame})` }} className="shop-item-image" />
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
                <div key={character.id} className="character-full" onClick={() => this.openDialog(DialogType.CHARACTER_PURCHASE, character)}>
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
                              <span>{character.stats[stat]}</span>
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
                                actionType={InventoryType.SKILLS}
                                key={i}
                              />
                            ))}
                            </div>
                          </div>}
                        </div>
                      </div>
                      <div className="character-portrait" style={{backgroundImage: `url(/sprites/${character.portrait}.png)`}} />
                  </div>
                </div>
              ))}
            </div>

        {openDialog === DialogType.ITEM_PURCHASE && (
          <div className="dialog">
            <div className="shop-item-card-header">
              <div className="shop-item-card-name">Buy</div>
              <div className="shop-item-card-name-shadow">Buy</div>
            </div>
            <div className="shop-item-card-content">
            <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeDialog} >X</i>
              <div className="purchase-dialog">
                <div className="purchase-item">
                  <span className="purchase-item-name">{selectedArticle.name} x</span>
                  <div className="purchase-quantity-selector">
                    <button className="purchase-adjust purchase-minus" onClick={() => this.changeQuantity(-1)}>-</button>
                    <input type="text" className="purchase-quantity" value={quantity} />
                    <button className="purchase-adjust  purchase-plus" onClick={() => this.changeQuantity(1)}>+</button>
                  </div>
                </div>
                <div className="purchase-total">
                  <span>Total: {totalPrice}G</span>
                </div>
                <button className="purchase-buy-button" onClick={this.purchase}>BUY</button>
              </div>
            </div>
          </div>
        )}

        {openDialog === DialogType.CHARACTER_PURCHASE && (
          <div className="dialog">
            <div className="shop-item-card-header">
              <div className="shop-item-card-name">Buy</div>
              <div className="shop-item-card-name-shadow">Buy</div>
            </div>
            <div className="shop-item-card-content">
            <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeDialog} >X</i>
              <div className="purchase-dialog">
                <div className="purchase-item">
                  <span className="purchase-item-name">{selectedArticle.name} x</span>
                </div>
                <div className="purchase-total">
                  <span>Total: {totalPrice}G</span>
                </div>
                <button className="purchase-buy-button" onClick={this.purchase}>BUY</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ShopPage;