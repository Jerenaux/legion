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
    category?: string;
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
  }

  componentDidUpdate() {
    if (this.context.player.isLoaded) {
      if (!this.context.checkEngagementFlag('everPurchased')) {
        if (!this.props.matches.category || this.props.matches.category == 'consumables') {
          this.popupManagerRef.current?.enqueuePopup(Popup.BuySomething);
        }
      } else if (!this.context.checkEngagementFlag('everEquippedConsumable') && this.context.hasConsumable()) {
        this.popupManagerRef.current?.enqueuePopup(Popup.GoTeamPage);
      } else if (
        !this.context.checkEngagementFlag('everEquippedEquipment') && 
        this.context.hasEquipableEquipment()
      ) {
        this.popupManagerRef.current?.enqueuePopup(Popup.GoTeamPage);
      } else if (
        !this.context.checkEngagementFlag('everEquippedSpell') && 
        this.context.hasEquipableSpells()
      ) {
        this.popupManagerRef.current?.enqueuePopup(Popup.GoTeamPage);
      }
    }
  }

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
    // Consider a parameter as present only if it exists and isn't empty
    const hasValidId = 'id' in this.props.matches && this.props.matches.id !== '';

    return (
        <div className="shop-container">
          <PopupManager 
            ref={this.popupManagerRef}
            onPopupResolved={() => {}}
          />
          <ShopContent
            characters={this.state.characters} 
            requiredTab={ShopTab[this.props.matches.category?.toUpperCase()]}
            highlightedItemId={hasValidId ? this.props.matches.id : undefined}
            fetchCharactersOnSale={this.fetchCharactersOnSale.bind(this)}
          />
      </div>
    );
  }
}

export default ShopPage;