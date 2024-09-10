import { h, Component } from 'preact';
import { apiFetch } from '../services/apiService';
import { errorToast } from './utils';
import { DBCharacterData } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';
import { ShopTab } from '@legion/shared/enums';
import { PlayerContext } from '../contexts/PlayerContext';
import { manageHelp } from './utils';

enum DialogType {
  ITEM_PURCHASE,
  CHARACTER_PURCHASE,
  EQUIPMENT_PURCHASE,
  NONE // Represents no dialog open
}

interface State {
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
    characters: [],
    openDialog: DialogType.NONE,
    quantity: 1,
  };

  async componentDidMount() {
    this.fetchCharactersOnSale();
    manageHelp('shop', this.context);
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
            characters={this.state.characters} 
            requiredTab={ShopTab[this.props.matches.id?.toUpperCase()]}
            fetchCharactersOnSale={this.fetchCharactersOnSale.bind(this)}
          />
      </div>
    );
  }
}

export default ShopPage;