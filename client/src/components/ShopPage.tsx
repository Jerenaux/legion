import { h, Component, createRef } from 'preact';
import { apiFetch } from '../services/apiService';
import { DBCharacterData } from '@legion/shared/interfaces';
import ShopContent from './shopContent/ShopContent';
import { ShopTab } from '@legion/shared/enums';
import { PlayerContext } from '../contexts/PlayerContext';
import PopupManager, { Popup } from './popups/PopupManager';

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

  popupManagerRef = createRef();

  async componentDidMount() {
    this.fetchCharactersOnSale();
    
    if (!this.context.checkEngagementFlag('everPurchased')) {
      this.popupManagerRef.current?.enqueuePopup(Popup.BuySomething);
    } else if (!this.context.checkEngagementFlag('everEquippedConsumable')) {
      this.popupManagerRef.current?.enqueuePopup(Popup.GoTeamPage);
    }
  }

  handlePopupResolved = (popup: Popup) => {
    
  };

  async fetchCharactersOnSale() { 
    // await new Promise(resolve => setTimeout(resolve, 2000)); 
    try {
        const data = await apiFetch('listOnSaleCharacters');

        this.setState({ 
            characters: data
        });
    } catch (error) {
        console.error(`Error: ${error}`);
    }
  }

  render() {
    return (
        <div className="shop-container">
          <PopupManager 
            ref={this.popupManagerRef}
            onPopupResolved={this.handlePopupResolved}
          />
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