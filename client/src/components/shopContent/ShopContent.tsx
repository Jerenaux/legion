import './ShopContent.style.css';
import 'react-loading-skeleton/dist/skeleton.css'

import Skeleton from 'react-loading-skeleton';
import { h, Component } from 'preact';
import { PlayerContext } from '../../contexts/PlayerContext';
import { apiFetch } from '../../services/apiService';
import { InventoryType, ShopTab, EquipmentSlot, equipmentSlotLabelsPlural } from '@legion/shared/enums';
import { MAX_CHARACTERS } from "@legion/shared/config";
import { ShopItems, DBCharacterData } from '@legion/shared/interfaces';
import { errorToast, successToast, playSoundEffect, silentErrorToast } from '../utils';
import ShopSpellCard from '../shopSpellCard/ShopSpellCard';
import ShopConsumableCard from '../shopConsumableCard/ShopConsumableCard';
import ShopEquipmentCard from '../shopEquipmentCard/ShopEquipmentCard';
import ShopCharacterCard from '../shopCharacterCard/shopCharacterCard';
import PurchaseDialog from '../purchaseDialog/PurchaseDialog';
import ShopItemFilter from '../shopItemFilter/ShopItemFilter';
import { spells } from '@legion/shared/Spells';
import { items } from '@legion/shared/Items';
import { equipments } from '@legion/shared/Equipments';
import { inventorySize } from '@legion/shared/utils';
import { Link } from 'preact-router';

import spellsIcon from '@assets/shop/spells_icon.png';
import consumablesIcon from '@assets/shop/consumables_icon.png';
import equipmentsIcon from '@assets/shop/helmet_icon.png';
import charactersIcon from '@assets/shop/char_icon.png';

import purchaseSfx from '@assets/sfx/purchase.wav';
import { BaseEquipment } from '@legion/shared/BaseEquipment';

interface ShopContentProps {
    characters: DBCharacterData[];
    requiredTab: number;
    fetchCharactersOnSale: () => void;
}

export interface modalData {
    id: string;
    name: string;
    frame: number;
    url: string;
    price: number;
    isCharacter?: boolean;
}

function sortByRarityAndPrice(a: any, b: any) {
    if (a.rarity === b.rarity) {
        return a.price - b.price;
    }
    return a.rarity - b.rarity;
}

const TAB_LABELS = ['Consumables', 'Equipment', 'Spells', 'Characters'];

const groupEquipmentByType = (equipment: BaseEquipment[]) => {
    return equipment.reduce<Record<string, BaseEquipment[]>>((acc, item) => {
        if (!acc[item.slot]) {
            acc[item.slot] = [];
        }
        acc[item.slot].push(item);
        return acc;
    }, {});
};

class ShopContent extends Component<ShopContentProps> {
    static contextType = PlayerContext;

    state = {
        curr_tab: ShopTab.CONSUMABLES,
        openModal: false,
        position: null,
        modalData: null,
        inventoryData: {
            consumables: items.sort(sortByRarityAndPrice),
            equipment: equipments.sort(sortByRarityAndPrice),
            spells: spells.sort(sortByRarityAndPrice)
        },
        isLoadingCharacters: false,
    }

    componentDidMount(): void {
        this.setState({ curr_tab: this.props.requiredTab ?? ShopTab.CONSUMABLES }, () => {
            if (this.state.curr_tab === ShopTab.CHARACTERS) {
                this.loadCharacters();
            }
        });
    }

    loadCharacters = async () => {
        this.setState({ isLoadingCharacters: true });
        try {
            await this.props.fetchCharactersOnSale();
        } catch (error) {
            console.error("Error fetching characters:", error);
            errorToast("Failed to load characters. Please try again.");
        } finally {
            this.setState({ isLoadingCharacters: false });
        }
    }

    handleOpenModal = (e: any, modalData: modalData) => {
        const elementRect = e.currentTarget.getBoundingClientRect();

        const modalPosition = {
            top: Math.min(elementRect.top + elementRect.height / 2, window.innerHeight - elementRect.height + 40),
            left: elementRect.left + elementRect.width / 2,
        };

        this.setState({ openModal: true, position: modalPosition, modalData });
    }

    handleCloseModal = () => {
        this.setState({ openModal: false });
    }

    handleInventory = (inventory: ShopItems) => {
        this.setState({ inventoryData: inventory });
    }

    hasEnoughGold = (quantity: number) => {
        return this.context.player.gold >= this.state.modalData.price * quantity;
    }

    purchase = async (id: string | number, quantity: number, price: number) => {
        if (!id && id != 0) {
            errorToast('No article selected!');
            return;
        }

        if (!this.hasEnoughGold(quantity)) {
            silentErrorToast('Not enough gold!');
            return;
        }

        const purchasingCharacter = this.state.curr_tab == ShopTab.CHARACTERS;

        if (purchasingCharacter) {
            if (this.context.characters.length >= MAX_CHARACTERS) {
                silentErrorToast('Character limit reached!');
                return;
            }
        } else {
            if (inventorySize(this.context.player.inventory) + quantity > this.context.player.carrying_capacity) {
                silentErrorToast('Not enough room in inventory!');
                return;
            }
        }

        const payload = {
            articleId: id,
            quantity,
            inventoryType: this.state.curr_tab
        };

        if (!purchasingCharacter) this.context.applyPurchase(id, price, quantity, this.state.curr_tab);
        playSoundEffect(purchaseSfx);
        successToast('Purchase successful!');
        this.handleCloseModal();

        await apiFetch(purchasingCharacter ? 'purchaseCharacter' : 'purchaseItem', {
            method: 'POST',
            body: payload
        })
            .then(data => {
                if (purchasingCharacter) {
                    this.props.fetchCharactersOnSale();
                }
            })
            .catch(error => errorToast(`Error: ${error}`));

        if (purchasingCharacter) this.context.applyPurchase(id, price, quantity, this.state.curr_tab);
    }

    render() {
        if (!this.state.inventoryData) return null;

        const defaultShopItems = {
            consumables: items,
            equipment: equipments,
            spells: spells
        };

        const { characters } = this.props;

        const getItemAmount = (index: number, type: InventoryType) => {
            return this.context.player.inventory[type].filter((item: number) => item == index).length;
        }

        const renderItems = () => {
            switch (this.state.curr_tab) {
                case ShopTab.SPELLS:
                    return this.state.inventoryData.spells.map((item, index) => 
                        <ShopSpellCard key={index} data={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />
                    );
                case ShopTab.CONSUMABLES:
                    return this.state.inventoryData.consumables.map((item, index) => 
                        <ShopConsumableCard key={index} data={item} getItemAmount={getItemAmount} handleOpenModal={this.handleOpenModal} />
                    );
                case ShopTab.EQUIPMENTS: {
                    const groupedEquipment = groupEquipmentByType(this.state.inventoryData.equipment);
                    return (
                        <div className="equipment-sections">
                            {Object.entries(groupedEquipment).map(([slot, items]) => (
                                <div key={slot} className="equipment-section">
                                    <h3 className="equipment-type-title">
                                        {equipmentSlotLabelsPlural[slot as unknown as EquipmentSlot]}
                                    </h3>
                                    <div className="equipment-grid">
                                        {items.map((item: BaseEquipment, index: number) => 
                                            <ShopEquipmentCard 
                                                key={index} 
                                                data={item} 
                                                getItemAmount={getItemAmount} 
                                                handleOpenModal={this.handleOpenModal} 
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                }
                case ShopTab.CHARACTERS:
                    return this.state.isLoadingCharacters ? 
                        renderSkeletons() :
                        characters?.map((item, index) => 
                            <ShopCharacterCard key={index} data={item} handleOpenModal={this.handleOpenModal} />
                        );
                default:
                    return null;
            }
        }

        const renderSkeletons = () => (
            <div className="shop-items-container"
            style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}
            >
                {[...Array(12)].map((_, index) => (
                    <div key={index} >
                        <Skeleton
                            height={320}
                            width={200} 
                            highlightColor="#0000004d"
                            baseColor="#0f1421"
                        />
                    </div>
                ))}
            </div>
        )

        const shopTabIcons = [consumablesIcon, equipmentsIcon, spellsIcon, charactersIcon];

        return (
            <div className='shop-content'>
                <ShopItemFilter
                    curr_tab={this.state.curr_tab}
                    shopItems={defaultShopItems}
                    handleInventory={this.handleInventory} />

                <div className='shop-tabs-container'>
                    {this.state.inventoryData && shopTabIcons.map((icon, index) =>
                        <Link
                            href={`/shop/${ShopTab[index].toLowerCase()}`}
                            onClick={() => {
                                this.setState({ curr_tab: index });
                                if (index === ShopTab.CHARACTERS) {
                                    this.loadCharacters();
                                }
                            }}
                            key={index}
                            className={`shop-tab-item ${index === this.state.curr_tab ? 'active' : ''}`}
                        >
                            <img src={icon} alt={`${ShopTab[index]} icon`} />
                            <span className="shop-tab-label">{TAB_LABELS[index]}</span>
                        </Link>
                    )}
                </div>
                <div className='shop-items-container'>{renderItems()}</div>
                <PurchaseDialog
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