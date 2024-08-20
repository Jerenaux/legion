import { h, Component } from 'preact';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import { DBCharacterData, PlayerInventory } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';
import {ShopTabs} from '@legion/shared/enums';
import { PlayerContext } from '../contexts/PlayerContext';
import { startTour } from './tours';

enum DialogType {
  ITEM_PURCHASE,
  CHARACTER_PURCHASE,
  EQUIPMENT_PURCHASE,
  NONE // Represents no dialog open
}

interface State {
  gold: number;
  inventory: PlayerInventory;
  carrying_capacity: number;
  nb_characters: number;
  characters: DBCharacterData[]; // Characters on sale
  openDialog: DialogType;
  quantity: number;
}

interface ShopPageProps {
  matches: {
    id?: string;
  };
}

class ShopPage extends Component<ShopPageProps, State> {
  static contextType = PlayerContext; 

  state: State = {
    gold: 0,
    inventory: {
      consumables: [],
      equipment: [],
      spells: [],
    },
    carrying_capacity: 0,
    nb_characters: 0,
    characters: [],
    openDialog: DialogType.NONE,
    quantity: 1,
  };

  async componentDidMount() {
    await this.fetchInventoryData(); 
    this.fetchCharactersOnSale();
    startTour('shop', this.context.player.tours);
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
            carrying_capacity: data.carrying_capacity,
            nb_characters: data.nb_characters,
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
        default:
            return;
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
    // await new Promise(resolve => setTimeout(resolve, 2000)); 
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
            carrying_capacity={this.state.carrying_capacity}
            nb_characters={this.state.nb_characters}
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