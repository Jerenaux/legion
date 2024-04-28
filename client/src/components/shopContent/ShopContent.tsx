// ShopContent.tsx
import './ShopContent.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import Skeleton from 'react-loading-skeleton';
import { h, Component } from 'preact';
import { PlayerContext } from '../../contexts/PlayerContext';
import { apiFetch } from '../../services/apiService';
import { InventoryType, ShopTabs } from '@legion/shared/enums';
import { PlayerInventory, ShopItems } from '@legion/shared/interfaces';
import { ShopTabIcons } from './ShopContent.data';
import { errorToast, successToast } from '../utils';
import ShopSpellCard from '../shopSpellCard/ShopSpellCard';
import ShopConsumableCard from '../shopConsumableCard/ShopConsumableCard';
import ShopEquipmentCard from '../shopEquipmentCard/ShopEquipmentCard';
import ShopCharacterCard from '../shopCharacterCard/shopCharacterCard';
import PurchaseDialog from '../purchaseDialog/PurchaseDialog';
import ShopItemFilter from '../shopItemFilter/ShopItemFilter';
import { spells } from '@legion/shared/Spells';
import { items } from '@legion/shared/Items';
import { equipments } from '@legion/shared/Equipments';
import { Link } from 'preact-router';
interface ShopContentProps {
    gold: number;
    requireTab: number;
    characters: CharacterData[];
    inventory: PlayerInventory;
    fetchInventoryData: () => void;
    updateInventory: (articleId: string, quantity: number, shoptab: ShopTabs) => void;
    fetchCharactersOnSale: () => void;
}

interface modalData {
    id: string;
    name: string;
    url: string;
    price: number;
}

class ShopContent extends Component<ShopContentProps> {
    static contextType = PlayerContext; 
    
    state = {
        curr_tab: ShopTabs.CONSUMABLES,
        openModal: false,
        position: null,
        modalData: null,
        inventoryData: {
            consumables: items,
            equipment: equipments,
            spells: spells
        },
    }

    componentDidMount(): void {
        this.setState({curr_tab: this.props.requireTab ?? ShopTabs.CONSUMABLES});
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

    handleInventory = (inventory: ShopItems) => {
        this.setState({inventoryData: inventory});
    }

    hasEnoughGold = (quantity: number) => {
        return this.props.gold >= this.state.modalData.price * quantity;
    }

    purchase = (id: string | number, quantity: number, price: number) => {
        if (!id && id != 0) {
            errorToast('No article selected!');
            return;
        }

        if (!this.hasEnoughGold(quantity)) {
            errorToast('Not enough gold!');
            return;
        }

        const payload = {
            articleId: id,
            quantity,
            inventoryType: this.state.curr_tab
        };
        console.log(payload);

        this.props.updateInventory(id.toString(), quantity, this.state.curr_tab);
        this.context.setPlayerInfo({ gold: this.props.gold - price * quantity });

        apiFetch(this.state.curr_tab == ShopTabs.CHARACTERS ? 'purchaseCharacter' : 'purchaseItem', {
            method: 'POST',
            body: payload
        })
            .then(data => {
                console.log(data);
                if (this.state.curr_tab == ShopTabs.CHARACTERS) {
                    this.props.fetchCharactersOnSale();
                } else {
                    this.props.fetchInventoryData();
                }
                successToast('Purchase successful!');
            })
            .catch(error => errorToast(`Error: ${error}`));

        this.handleCloseModal();
    }

    render() {
        if (!this.props.characters) return;
        if(!this.state.inventoryData) return;

        const defaultShopItems = {
            consumables: items,
            equipment: equipments,
            spells: spells
        };

        const { characters } = this.props;

        const tabItemStyle = (index: number) => {
            return {
                backgroundImage: `url(/shop/tabs_${index === this.state.curr_tab ? 'active' : 'idle'}.png)`,
            }
        }

        const getItemAmount = (index: number, type: InventoryType) => {
            return this.props.inventory[type].filter((item: number) => item == index).length;
        }

        const renderItems = () => {
            switch (this.state.curr_tab) {
                case ShopTabs.SPELLS:
                    return this.state.inventoryData.spells.map((item, index) => <ShopSpellCard key={index} data={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.CONSUMABLES:
                    return this.state.inventoryData.consumables.map((item, index) => <ShopConsumableCard key={index} data={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.EQUIPMENTS:
                    return this.state.inventoryData.equipment.map((item, index) => <ShopEquipmentCard key={index} data={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />)
                case ShopTabs.CHARACTERS:
                    return characters?.map((item, index) => <ShopCharacterCard key={index} data={item} handleOpenModal={this.handleOpenModal} />)
                default:
                    return null;
            }
        }

        return (
            <div className='shop-content'>
                <ShopItemFilter
                 curr_tab={this.state.curr_tab}
                 shopItems={defaultShopItems}
                 handleInventory={this.handleInventory} />
                 
                <div className='shop-tabs-container'>
                    {this.state.inventoryData && Object.keys(ShopTabIcons).map(key => ShopTabIcons[key]).map((icon, index) =>
                        <Link
                            href={`/shop/${ShopTabs[index].toLowerCase()}`}
                            onClick={() => this.setState({curr_tab: index})}
                            key={index}
                            className='shop-tab-item'
                            style={tabItemStyle(index)}>
                            <img src={`/shop/${icon}`} alt="icon" />
                        </Link>
                    )}
                </div>
                {this.state.inventoryData ? <div className='shop-items-container'>{renderItems()}</div> : (
                    <Skeleton 
                        height={332} 
                        count={2} 
                        highlightColor='#0000004d' 
                        baseColor='#0f1421' 
                        style={{margin: '2px 0', width: '1024px', height: '628px'}}/>
                )}
                <PurchaseDialog
                    gold={this.props.gold}
                    position={this.state.position}
                    dialogOpen={this.state.openModal}
                    dialogData={this.state.modalData}
                    handleClose={this.handleCloseModal}
                    purchase={this.purchase}
                />
            </div>
        );
    }
}

export default ShopContent;