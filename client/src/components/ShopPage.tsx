import { h, Component } from 'preact';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import { PlayerInventory } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';
import {ShopTabs} from '@legion/shared/enums';

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

interface ShopPageProps {
  matches: {
    id?: string;
  };
}

class ShopPage extends Component<ShopPageProps, State> {

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

  updateInventory(articleId: string, quantity: number, shoptab: ShopTabs) {
    const { inventory } = this.state;
    let inventoryField = '';
    switch (shoptab) {
        case ShopTabs.CONSUMABLES:
            inventoryField = 'consumables';
            break;
        case ShopTabs.EQUIPMENTS:
            inventoryField = 'equipment';
            break;
        case ShopTabs.SPELLS:
            inventoryField = 'spells';
            break;
    }
    for(let i = 0; i < quantity; i++) {
        inventory[inventoryField].push(articleId);
    }

    this.setState({
        inventory: {
            ...inventory,
            [inventoryField]: inventory[inventoryField].sort()
        }
    });
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
            requireTab={ShopTabs[this.props.matches.id?.toUpperCase()]}
            inventory={this.state.inventory}
            characters={this.state.characters} 
            fetchInventoryData={this.fetchInventoryData.bind(this)}
            updateInventory={this.updateInventory.bind(this)}
            fetchCharactersOnSale={this.fetchCharactersOnSale.bind(this)}
          />
      </div>
    );
  }
}

export default ShopPage;