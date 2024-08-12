import { h, Component } from 'preact';
import './CharacterSheet.style.css';
import { classEnumToString, mapFrameToCoordinates } from '../utils';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { getEquipmentById } from '@legion/shared/Equipments';
import { getSpellById } from '@legion/shared/Spells';
import { getConsumableById } from '@legion/shared/Items';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from '../itemDialog/ItemDialogType';
import ItemDialog from '../itemDialog/ItemDialog';
import { getXPThreshold } from '@legion/shared/levelling';
import { InventoryActionType, InventoryType, RarityColor } from '@legion/shared/enums';
import { Effect } from '@legion/shared/interfaces';

interface InventoryRequestPayload {
    characterId: string;
    characterData: any;
    itemEffects: Effect[];
    refreshCharacter: () => void;
    handleItemEffect: (effects: Effect[], actionType: InventoryActionType) => void;
    updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
}

class CharacterSheet extends Component<InventoryRequestPayload> {
    state = {
        characterItems: [],
        itemIndex: 0,
        openModal: false,
        modalType: ItemDialogType.EQUIPMENTS,
        modalData: null,
        modalPosition: {
            top: 0,
            left: 0
        },
        powerUpActive: false, //this.props.powerUpActive
    }

    handleOpenModal = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment | CHARACTER_INFO, modalType: string, index: number) => {
        const elementRect = e.currentTarget.getBoundingClientRect();

        const modalPosition = {
            top: elementRect.top + elementRect.height / 2,
            left: elementRect.left + elementRect.width / 2,
        };

        this.setState({ openModal: true, modalType, modalPosition, modalData, itemIndex: index });
    }

    handleCloseModal = () => {
        this.setState({ openModal: false });
        this.props.handleItemEffect([], InventoryActionType.UNEQUIP);
    }

    handleUnEquipItem = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment, modalType: string, index: number) => {
        if (!modalData) return;
        this.handleOpenModal(e, modalData, modalType, index);
        this.props.handleItemEffect(modalData.effects, InventoryActionType.UNEQUIP);
    }

    render() {
        const { characterId, characterData, refreshCharacter } = this.props;
        if (!this.props.characterData) return;

        const renderInfoBars = () => {
            if (!characterData) return;
            const items = Object.entries(characterData.stats).map(([key, value]) => {
                const equipmentBonus = characterData.equipment_bonuses[key] || 0; // Fallback to 0 if key is not present
                const spBonus = characterData.sp_bonuses[key] || 0; // Fallback to 0 if key is not present
                return {
                    key,
                    value: value + equipmentBonus + spBonus // Sum the values from the three sources
                };
            });


            const order = ['hp', 'mp', 'atk', 'def', 'spatk', 'spdef'];
            const rearrangedItems = order.map(key => items.find(item => item.key === key));

            const effectVal = (key: string) => {
                return this.props.itemEffects.filter(effect => order[effect.stat] === key)[0]?.value;
            }

            const effectString = (key: string) => {
                const val = effectVal(key);

                if (val !== 0) {
                    return val > 0 ? `+${val}` : val;
                }

                return null;
            }

            return rearrangedItems.map((item, index) => (
                <div className="character-info-bar" key={index}>
                    <div className="info-class" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[item.key]] }}><span>{INFO_TYPE[item.key]}</span></div>
                    <div className="curr-info-container">
                        <p className="curr-info">{item.value}
                            <span style={effectVal(item.key) > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{effectString(item.key)}</span>
                        </p>
                    </div>

                    {characterData?.sp > 0 && <button className="info-bar-plus" onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.CHARACTER_INFO, index)}></button>}
                </div>
            ));
        };

        const renderEquipmentItems = (itemCategory) => {
            if (!characterData || !characterData.equipment) return;

            let items, desiredOrder, backgroundImageUrl, isSpecialEquip;
            const specialSlotsStart = 6;

            // Configure based on the category of items to render
            switch (itemCategory) {
                case 'standardEquip':
                    items = Object.entries(characterData.equipment)
                        .map(([key, value]) => ({ key, value }))
                        .slice(0, specialSlotsStart); // Standard equipment slots
                    backgroundImageUrl = 'equipment.png';
                    isSpecialEquip = false;
                    break;
                case 'specialEquip':
                    items = Object.entries(characterData.equipment)
                        .map(([key, value]) => ({ key, value }))
                        .slice(specialSlotsStart, 9); // Special equipment slots
                    desiredOrder = ['left_ring', 'right_ring', 'necklace'];
                    items.sort((a, b) => desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
                    backgroundImageUrl = 'equipment.png';
                    isSpecialEquip = true;
                    break;
                default:
                    return null; // Or an empty component
            }

            return items.map((item, index) => {
                if (isSpecialEquip) index += specialSlotsStart;
                let content;
                const itemData = getEquipmentById(item.value);
                if (item.value < 0) {
                    // Handle the case where there is no item equipped in this slot
                    content = (
                        <img src={`/inventory/${item.key}_icon.png`} alt={item.key}
                            style={{ transform: isSpecialEquip ? 'scaleY(0.6)' : 'scale(0.8)' }} />
                    );
                } else {
                    // Handle the case where there is an item equipped
                    const coordinates = mapFrameToCoordinates(itemData.frame);
                    content = (
                        <div className="special-equip" style={{
                            backgroundImage: `url(${backgroundImageUrl})`,
                            backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
                        }} />
                    );
                }

                const equipmentItem = getEquipmentById(item.value); 

                const slotStyle = {
                    backgroundImage: item.value >= 0 && `linear-gradient(to bottom right, ${RarityColor[equipmentItem?.rarity]}, #1c1f25)`
                } 
                
                console.log("itemData => ", itemData); 

                // Return the container div for each item
                return (
                    <div
                        key={index}
                        className="sheet-item"
                        style={itemData !== undefined && slotStyle} 
                        // style={(inventoryType === InventoryType.SKILLS || inventoryType === InventoryType.CONSUMABLES) && slotStyle}
                        onClick={(e) => this.handleUnEquipItem(e, itemData, ItemDialogType.EQUIPMENTS, index)}>
                        {content}
                    </div>
                );
            });
        };


        const renderInventoryItems = (inventoryType) => {
            if (!characterData) return;

            // Define the capacity and array of items based on type
            let capacity, items, dialogType, backgroundImageUrl, dataCallback;
            switch (inventoryType) {
                case InventoryType.CONSUMABLES:
                    capacity = characterData.carrying_capacity + characterData.carrying_capacity_bonus;
                    items = characterData.inventory;
                    dialogType = ItemDialogType.CONSUMABLES;
                    backgroundImageUrl = 'consumables.png';
                    dataCallback = getConsumableById;
                    break;
                case InventoryType.SKILLS:
                    capacity = characterData.skill_slots;
                    items = characterData.skills;
                    dialogType = ItemDialogType.SKILLS;
                    backgroundImageUrl = 'spells.png';
                    dataCallback = getSpellById;
                    break;
                // Add other cases for different types
                default:
                    return null; // Or render an empty component/error message
            }

            return Array.from({ length: capacity }, (_, i) => {
                if (i < items.length) {
                    const item = dataCallback(items[i]);
                    const coordinates = mapFrameToCoordinates(item?.frame);

                    const slotStyle = {
                        backgroundImage: `linear-gradient(to bottom right, ${RarityColor[item?.rarity]}, #1c1f25)`
                    }

                    return (
                        <div className="team-item" key={i} style={(inventoryType === InventoryType.SKILLS || inventoryType === InventoryType.CONSUMABLES) && slotStyle} onClick={(e) => this.handleOpenModal(e, item, dialogType, i)}>
                            <div className="special-equip" style={{
                                backgroundImage: `url(${backgroundImageUrl})`,
                                backgroundPosition: `-${coordinates.x}px -${coordinates.y}px`,
                            }} />
                        </div>
                    );
                } else {
                    return <div className="team-item" key={i} />;
                }
            });
        };

        const xpToLevel = getXPThreshold(characterData?.level);

        const portraitStyle = {
            backgroundImage: `url(/sprites/${characterData?.portrait ?? '1_1'}.png)`,
            animation: 'animate-sprite 0.7s steps(1) infinite',
        };

        const overlayStyle = { // Used for "power up" animation
            backgroundImage: this.state.powerUpActive ? `url(/animations/potion_heal.png)` : 'none',
            animation: this.state.powerUpActive ? 'power-up-animation 3s steps(16) infinite' : 'none', // Assuming 10 frames in the animation
            display: this.state.powerUpActive ? 'block' : 'none'
        };

        const sliderStyle = {
            width: `${characterData?.xp * 100 / xpToLevel}%`,
        }

        return (
            <div className="team-content-card-container">
                <div className="team-content-container">
                    <div className="team-level">
                        <span>Lvl</span>
                        <span className="level-span">{characterData?.level}</span>
                    </div>
                    <div className="team-info-container">
                        <div className="team-info">
                            <p className="team-character-name">{characterData?.name}</p>
                            <p className="team-character-class">{classEnumToString(characterData?.class)}</p>
                            <div className="team-exp-slider-container">
                                <div className="team-curr-exp-slider" style={sliderStyle}></div>
                            </div>
                            <div className="team-exp-info">
                                <span>EXP <span className="team-curr-exp">{Math.round(characterData?.xp)}</span> / <span className="team-total-exp">{xpToLevel}</span></span>
                            </div>
                        </div>
                        <div className="team-sp-container">
                            <span>SP</span>
                            <span className="sp-span">{characterData?.sp}</span>
                        </div>
                    </div>
                    <div className="team-character-info-container">
                        <div className="team-character-container">
                            <div className="team-character" style={portraitStyle}></div>
                            <div className="team-character-overlay" style={overlayStyle}></div>
                        </div>
                        <div className="team-character-info">
                            {renderInfoBars()}
                        </div>
                    </div>
                    <div className="team-items-container">
                        <div className="character-icon-container">
                            {/* {renderCharacterItems()} */}
                            {renderEquipmentItems('specialEquip')}
                        </div>
                        <div className="team-item-container">
                            <p className="team-item-heading">SPELLS</p>
                            <div className="team-items">
                                {renderInventoryItems(InventoryType.SKILLS)}
                            </div>
                        </div>
                        <div className="team-item-container">
                            <p className="team-item-heading">ITEMS</p>
                            <div className="team-items">
                                {renderInventoryItems(InventoryType.CONSUMABLES)}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="team-equip-container">
                    {renderEquipmentItems('standardEquip')}
                </div>
                <ItemDialog
                    isEquipped={true}
                    actionType={InventoryActionType.UNEQUIP}
                    refreshCharacter={refreshCharacter}
                    characterId={characterId}
                    index={this.state.itemIndex}
                    dialogOpen={this.state.openModal}
                    dialogType={this.state.modalType}
                    position={this.state.modalPosition}
                    dialogData={this.state.modalData}
                    handleClose={this.handleCloseModal}
                    updateInventory={this.props.updateInventory}
                />
            </div>
        );
    }
}

export default CharacterSheet;