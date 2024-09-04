import { h, Component } from 'preact';
import './CharacterSheet.style.css';
import { classEnumToString, mapFrameToCoordinates, getSpritePath } from '../utils';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { getEquipmentById } from '@legion/shared/Equipments';
import { getSpellById } from '@legion/shared/Spells';
import { getConsumableById } from '@legion/shared/Items';
import { STATS_BG_COLOR, STATS_NAMES, ItemDialogType, SPSPendingData } from '../itemDialog/ItemDialogType';
import ItemDialog from '../itemDialog/ItemDialog';
import { getXPThreshold } from '@legion/shared/levelling';
import { EquipmentSlot, InventoryActionType, InventoryType, RarityColor, Stat, statFields } from '@legion/shared/enums';
import { APICharacterData, Effect } from '@legion/shared/interfaces';
import { equipmentFields } from '@legion/shared/enums';

import helmetIcon from '@assets/inventory/helmet_icon.png';
import armorIcon from '@assets/inventory/armor_icon.png';
import weaponIcon from '@assets/inventory/weapon_icon.png';
import beltIcon from '@assets/inventory/belt_icon.png';
import bootsIcon from '@assets/inventory/boots_icon.png';
import glovesIcon from '@assets/inventory/gloves_icon.png';
import leftRingIcon from '@assets/inventory/left_ring_icon.png';
import rightRingIcon from '@assets/inventory/right_ring_icon.png';
import necklaceIcon from '@assets/inventory/necklace_icon.png';

import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';

interface CharacterSheetProps {
    characterId: string;
    characterData: APICharacterData;
    itemEffects: Effect[];
    refreshCharacter: () => void;
    handleItemEffect: (effects: Effect[], actionType: InventoryActionType) => void;
    updateInventory?: (type: string, action: InventoryActionType, index: number) => void; 
    updateStats?: (stat: Stat, value: number) => void;
    selectedEquipmentSlot: number; 
    handleSelectedEquipmentSlot: (newValue: number) => void; 
}

class CharacterSheet extends Component<CharacterSheetProps> {
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

    handleOpenModal = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment | SPSPendingData, modalType: ItemDialogType, index: number) => {
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

    handleUnEquipItem = (e: any, modalData: BaseItem | BaseSpell | BaseEquipment, modalType: ItemDialogType, index: number) => {
        if (!modalData) return;
        this.handleOpenModal(e, modalData, modalType, index);
        this.props.handleItemEffect(modalData.effects, InventoryActionType.UNEQUIP);
    }

    render() {
        const { characterId, characterData, refreshCharacter } = this.props; 
        if (!this.props.characterData) return;

        const renderInfoBars = () => {
            if (!characterData) return;
            const characterStats = Object.entries(characterData.stats).map(([key, value]) => {
                const equipmentBonus = characterData.equipment_bonuses[key] || 0; // Fallback to 0 if key is not present
                const spBonus = characterData.sp_bonuses[key] || 0; // Fallback to 0 if key is not present
                return {
                    key,
                    value: value + equipmentBonus + spBonus // Sum the values from the three sources
                };
            });

            const rearrangedStats = statFields.map(key => characterStats.find(item => item.key === key));

            const effectVal = (key: string): number => {
                return this.props.itemEffects.filter(effect => statFields[effect.stat] === key)[0]?.value;
            }

            const totalStat = (baseValue: number, modifierKey: string) => {
                return baseValue + (effectVal(modifierKey) || 0);
            }

            return rearrangedStats.map((item, index) => (
                <div className="character-info-bar" key={index}>
                    <div className="info-class" style={{ backgroundColor: STATS_BG_COLOR[STATS_NAMES[item.key]] }}><span>{STATS_NAMES[item.key]}</span></div>
                    <div className="curr-info-container">
                        <p className="curr-info">
                            <span style={effectVal(item.key) > 0 ? { color: '#9ed94c' } : effectVal(item.key) < 0 ? { color: '#c95a74' } : {}}>{totalStat(item.value, item.key)}</span>
                        </p>
                    </div>

                    {characterData?.sp > 0 && <button className="info-bar-plus" onClick={
                            (e) => this.handleOpenModal(
                                e, 
                                {
                                    stat: index,
                                    value: item.value,
                                },
                                ItemDialogType.SP,
                                index
                            )
                        }></button>
                    }
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
                    backgroundImageUrl = equipmentSpritesheet;
                    isSpecialEquip = false;
                    break;
                case 'specialEquip':
                    items = Object.entries(characterData.equipment)
                        .map(([key, value]) => ({ key, value }))
                        .slice(specialSlotsStart, 9); // Special equipment slots
                    desiredOrder = ['left_ring', 'right_ring', 'necklace'];
                    items.sort((a, b) => desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key));
                    backgroundImageUrl = equipmentSpritesheet;
                    isSpecialEquip = true;
                    break;
                default:
                    return null; // Or an empty component
            }

            const getIconForSlot = (key) => {
                switch (key) {
                    case 'helmet': return helmetIcon;
                    case 'armor': return armorIcon;
                    case 'weapon': return weaponIcon;
                    case 'boots': return bootsIcon;
                    case 'belt': return beltIcon;
                    case 'gloves': return glovesIcon;
                    case 'left_ring': return leftRingIcon;
                    case 'right_ring': return rightRingIcon;
                    case 'necklace': return necklaceIcon;
                    default: return null;
                }
            };

            return items.map((item, index) => {
                if (isSpecialEquip) index += specialSlotsStart;
                let content;
                const itemData = getEquipmentById(item.value); 
                // console.log("sheetItemData => ", item); 
                if (item.value < 0) {
                    // Handle the case where there is no item equipped in this slot
                    content = (
                        <img src={getIconForSlot(item.key)} alt={item.key}
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
                
                if (this.props.selectedEquipmentSlot > -1) { // Equipping something
                    if (this.props.selectedEquipmentSlot == EquipmentSlot.LEFT_RING 
                        && characterData.equipment.left_ring != -1
                        && characterData.equipment.right_ring == -1
                    ) {
                        this.props.selectedEquipmentSlot = EquipmentSlot.RIGHT_RING;
                    }
                }

                
                // Return the container div for each item
                return (
                    <div
                      key={index}
                      className={`sheet-item ${
                        (itemData !== undefined)
                          ? ''
                          : (this.props.selectedEquipmentSlot > -1 && equipmentFields[this.props.selectedEquipmentSlot] === item.key)
                            ? 'blinking-gradient'
                            : ''
                      }`}
                      style={(itemData !== undefined) ? slotStyle : {}}
                      onClick={(e) => this.handleUnEquipItem(e, itemData, ItemDialogType.EQUIPMENTS, index)}
                    >
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
                    backgroundImageUrl = consumablesSpritesheet;
                    dataCallback = getConsumableById;
                    break;
                case InventoryType.SKILLS:
                    capacity = characterData.skill_slots;
                    items = characterData.skills;
                    dialogType = ItemDialogType.SPELLS;
                    backgroundImageUrl = spellsSpritesheet;
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
            backgroundImage: `url(${getSpritePath(characterData?.portrait)})`,
            animation: 'animate-sprite 0.7s steps(1) infinite',
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
                        </div>
                        <div className="team-character-info">
                            {renderInfoBars()}
                        </div>
                    </div>
                    <div className="team-items-container">
                        <div className="character-icon-container">
                            {renderEquipmentItems('specialEquip')}
                        </div>
                        {characterData.skill_slots > 0 && <div className="team-item-container">
                            <p className="team-item-heading">SPELLS</p>
                            <div className="team-items">
                                {renderInventoryItems(InventoryType.SKILLS)}
                            </div>
                        </div>}
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
                    characterSp={characterData?.sp}
                    characterName={characterData.name} 
                    characterLevel={characterData.level} 
                    characterClass={characterData.class} 
                    index={this.state.itemIndex}
                    dialogOpen={this.state.openModal}
                    dialogType={this.state.modalType}
                    position={this.state.modalPosition}
                    dialogData={this.state.modalData}
                    handleClose={this.handleCloseModal}
                    updateInventory={this.props.updateInventory} 
                    updateStats={this.props.updateStats}
                    handleSelectedEquipmentSlot={this.props.handleSelectedEquipmentSlot}
                />
            </div>
        );
    }
}

export default CharacterSheet;