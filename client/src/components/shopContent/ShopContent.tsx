// ShopContent.tsx
import './ShopContent.style.css';
import { h, Component } from 'preact';
import { apiFetch } from 'src/services/apiService';
import { InventoryType } from '@legion/shared/enums';
import { PlayerInventory } from '@legion/shared/interfaces';
import { ShopTabIcons, ShopTabs } from './ShopContent.data';
import { errorToast, successToast } from '../utils';
import ShopSpellCard from '../shopSpellCard/ShopSpellCard';
import ShopConsumableCard from '../shopConsumableCard/ShopConsumableCard';
import ShopEquipmentCard from '../shopEquipmentCard/ShopEquipmentCard';
import ShopCharacterCard from '../shopCharacterCard/shopCharacterCard';
import PurchaseDialog from '../purchaseDialog/PurchaseDialog';
interface ShopContentProps {
    gold: number;
    inventoryData: PlayerInventory;
    characters: CharacterData[];
    fetchInventoryData: () => void;
}

interface modalData {
    id: string;
    name: string;
    url: string;
    price: number;
}

class ShopContent extends Component<ShopContentProps> {
    state = {
        curr_tab: ShopTabs.CONSUMABLES,
        openModal: false,
        position: null,
        modalData: null,
    }

    handleOpenModal = (e: any, modalData: modalData) => {
        const elementRect = e.currentTarget.getBoundingClientRect();

        const modalPosition = {
            top: elementRect.top + elementRect.height / 2,
            left: elementRect.left + elementRect.width / 2,
        };

        this.setState({ openModal: true, position: modalPosition, modalData });
    }

    handleCloseModal = () => {
        this.setState({ openModal: false });
    }

    // hasEnoughGold = (articleId: string, quantity: number) => {
    //     const array = this.props.characters;
    //     const article = array.find((article) => article?.id === articleId);
    //     if (!article) {
    //       return false;
    //     }
    
    //     return this.state.gold >= article.price * quantity;
    //   }
    
    // purchase = () => {
    //     if (!selectedArticle) {
    //         errorToast('No article selected!');
    //         return;
    //     }

    //     if (!this.hasEnoughGold(selectedArticle.id, quantity, false)) {
    //         errorToast('Not enough gold!');
    //         return;
    //     }

    //     const payload = {
    //         articleId: selectedArticle.id,
    //         quantity,
    //     };
    //     console.log(payload);

    //     apiFetch('purchaseItem', {
    //         method: 'POST',
    //         body: payload
    //     })
    //     .then(data => {
    //         console.log(data);
    //         this.props.fetchInventoryData(); 
    //         successToast('Purchase successful!');
    //     })
    //     .catch(error => errorToast(`Error: ${error}`));
        
    //     this.handleCloseModal();
    // }

    render() {
        const {inventoryData, characters} = this.props;

        const tabItemStyle = (index: number) => {
            return {
                backgroundImage: `url(/shop/tabs_${index === this.state.curr_tab ? 'active' : 'idle'}.png)`,
            }
        }

        const getItemAmount = (index: number, type: InventoryType) => {
            return inventoryData[type].filter((item: number) => item == index).length;
        }

        const renderItems = () => {
            switch(this.state.curr_tab) {
                case ShopTabs.SPELLS:
                    return inventoryData.spells.map((item, index) => <ShopSpellCard key={index} index={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.CONSUMABLES:
                    return inventoryData.consumables.map((item, index) => <ShopConsumableCard key={index} index={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.EQUIPMENTS:
                    return inventoryData.equipment.map((item, index) => <ShopEquipmentCard key={index} index={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.CHARACTERS:
                    return characters.map((item, index) => <ShopCharacterCard key={index} data={item} handleOpenModal={this.handleOpenModal} />)
                default:
                    return null;
            }
        }

        return (
            <div className='shop-content'>
                <div className='shop-tabs-container'>
                    {Object.keys(ShopTabIcons).map(key => ShopTabIcons[key]).map((icon, index) =>
                        <div
                            key={index}
                            className='shop-tab-item'
                            style={tabItemStyle(index)}
                            onClick={() => this.setState({ curr_tab: index })}>
                            <img src={`/shop/${icon}`} alt="icon" />
                        </div>
                    )}
                </div>
                <div className='shop-items-container'>{renderItems()}</div>
                <PurchaseDialog
                    position={this.state.position}
                    dialogOpen={this.state.openModal}
                    dialogData={this.state.modalData}
                    handleClose={this.handleCloseModal}
                />
            </div>
        );
    }
}

export default ShopContent;