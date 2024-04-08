import { h, Component } from 'preact';
import Description from './Description';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../services/apiService';
import { classEnumToString, statStrings } from './utils';
import ActionItem from './game/HUD/Action';
import { spells } from '@legion/shared/Spells';
import { InventoryType } from '@legion/shared/enums';
import { successToast, errorToast } from './utils';
import { PlayerInventory } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';

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
  inventory: PlayerInventory;
  items: Array<any>;
  characters: Array<any>;
  openDialog: DialogType;
  selectedArticle: any;
  quantity: number;
}

class ShopPage extends Component<object, State> {

  state: State = {
    gold: 0,
    inventory: {
      consumables: [],
      equipment: [],
      spells: [],
    },
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
        console.log('____111111111____', data);
        this.setState({ 
            gold: data.gold,
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

  async fetchCharactersOnSale() {
    try {
        const data = await apiFetch('listOnSaleCharacters');
        console.log('____2222222____', data);

        this.setState({ 
            characters: data
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  getAmountOwned = (itemId) => {
    // TODO: need to implement this, by looking at the right field
    // in inventory and returning the amount
    // Old implementation:
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
        <div className="shop-container">
          <ShopContent inventoryData={this.state.inventory} characters={this.state.characters} />
      </div>
    );
  }
}

export default ShopPage;