import { h, Component } from 'preact';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import { PlayerInventory } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';

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

        this.setState({ 
            characters: data
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  render() {
    return (
        <div className="shop-container">
          <ShopContent
            gold={this.state.gold}
            inventoryData={this.state.inventory}
            characters={this.state.characters} 
            fetchInventoryData={this.fetchInventoryData}
          />
      </div>
    );
  }
}

export default ShopPage;