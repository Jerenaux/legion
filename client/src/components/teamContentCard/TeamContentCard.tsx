// TeamContentCard.tsx
import { h, Component } from 'preact';
import { useMemo } from 'react';
import './TeamContentCard.style.css';
import { classEnumToString, mapFrameToCoordinates } from '../utils';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { equipments } from '@legion/shared/Equipments';
import { spells } from '@legion/shared/Spells';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../../services/apiService';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from '../itemDialog/ItemDialogType';
import ItemDialog from '../itemDialog/ItemDialog';
import { getXPThreshold } from '@legion/shared/levelling';
import { InventoryActionType } from '@legion/shared/enums';
import { Effect } from '@legion/shared/interfaces';

interface InventoryRequestPayload {
    characterId: string;
    characterData: any;
    itemEffects: Effect[];
    refreshCharacter: () => void;
    handleItemEffect: (effects: Effect[], actionType: InventoryActionType) => void;
    updateInventory?: (type: string, action: InventoryActionType, index: number) => void;
}

class TeamContentCard extends Component<InventoryRequestPayload> {
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
        if(!this.props.characterData) return;

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

            const effectString = (val: number) => {
                return val > 0 ? `+${val}` : val;
            }

            const infoStyle = {
                paddingRight: characterData?.sp > 0 ? '' : '12px'
            }

            return rearrangedItems.map((item, index) => (
                <div className="character-info-bar" key={index}>
                    <div className="info-class" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[item.key]] }}><span>{INFO_TYPE[item.key]}</span></div>
                    <p className="curr-info" style={infoStyle}>{item.value}
                        <span style={effectVal(item.key) > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{effectString(effectVal(item.key))}</span>
                    </p>
                    {characterData?.sp > 0 && <button className="info-bar-plus" onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.CHARACTER_INFO, index)}></button>}
                </div>
            ));
        };

        const renderEquipItems = () => {
            if (!characterData || !characterData.equipment) return;
            const items = Object.entries(characterData.equipment).map(([key, value]) => ({ key, value: value as number })); // for equipments of right hand

            return items.slice(0, 6).map((item, index) => (
                <div className="equip-item" key={index} onClick={(e) => this.handleUnEquipItem(e, equipments[item.value], ItemDialogType.EQUIPMENTS, index)}>
                    {item.value < 0 ? (
                        <img src={`/inventory/${item.key}_icon.png`} alt={item.key} />
                    ) : (
                        <div className="special-equip" style={{
                            backgroundImage: `url(equipment.png)`,
                            backgroundPosition: `-${mapFrameToCoordinates(equipments[item.value].frame).x}px -${mapFrameToCoordinates(equipments[item.value].frame).y}px`,
                        }}></div>
                    )}
                </div>
            ));
            
        }

        const renderCharacterItems = useMemo(() => {
            if (!characterData || !characterData.equipment) return;
            const specialSlotsStart = 6;
            const items = Object.entries(characterData.equipment).map(([key, value]) => ({ key, value: value as number })).slice(specialSlotsStart, 9);
            const desiredOrder = ['left_ring', 'right_ring', 'necklace'];
            items.sort((a, b) => {
                return desiredOrder.indexOf(a.key) - desiredOrder.indexOf(b.key);
            });

            // ${equipments[item.value]?.frame}
            return items.map((item, index) => (
                <div className="equip-item sheet-item" key={index} onClick={(e) => this.handleOpenModal(e, equipments[item.value], ItemDialogType.EQUIPMENTS, specialSlotsStart + index)}>
                    {item.value < 0 ? (
                        <img style={{ transform: 'scaleY(0.6)' }} src={`/inventory/${item.key}_icon.png`} alt={item.key} />
                    ) : (
                        <div className="special-equip" style={{ 
                            backgroundImage: `url(equipment.png)`,
                            backgroundPosition: `-${mapFrameToCoordinates(equipments[item.value].frame).x}px -${mapFrameToCoordinates(equipments[item.value].frame).y}px`,
                        }}></div>
                    )}
                </div>
            ));
            
                  
        }, [characterData]);


        const renderSpellsItem = () => {
            if (!characterData) return;

            return Array.from({ length: characterData.skill_slots }, (_, i) => (
                i < characterData.skills.length ? (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, spells[characterData.skills[i]], ItemDialogType.SKILLS, i)}>
                        <div className="special-equip" style={{ 
                            backgroundImage: `url(spells.png)`,
                            backgroundPosition: `-${mapFrameToCoordinates(spells[characterData.skills[i]]?.frame).x}px -${mapFrameToCoordinates(spells[characterData.skills[i]]?.frame).y}px`,
                        }} />
                    </div>
                ) : (
                    <div className="team-item" key={i} >
                    </div>
                )
            ))
        };

        const renderConsumableItems = () => {
            if (!characterData) return;

            return Array.from({ length: characterData.carrying_capacity + characterData.carrying_capacity_bonus}, (_, i) => (
                i < characterData.inventory.length ? (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, items[characterData.inventory[i]], ItemDialogType.CONSUMABLES, i)}>
                        <div className="special-equip" style={{ 
                            backgroundImage: `url(consumables.png)`,
                            backgroundPosition: `-${mapFrameToCoordinates(items[characterData.inventory[i]]?.frame).x}px -${mapFrameToCoordinates(items[characterData.inventory[i]]?.frame).y}px`,
                        }} />
                    </div>
                ) : (
                    <div className="team-item" key={i} >
                    </div>
                )
            ))
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
                        <span>Lv</span>
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
                                <span>EXP <span className="team-curr-exp">{characterData?.xp}</span> / <span className="team-total-exp">{xpToLevel}</span></span>
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
                            {renderCharacterItems}
                        </div>
                        <div className="team-item-container">
                            <p className="team-item-heading">SPELLS</p>
                            <div className="team-items">
                                {renderSpellsItem()}
                            </div>
                        </div>
                        <div className="team-item-container">
                            <p className="team-item-heading">ITEMS</p>
                            <div className="team-items">
                                {renderConsumableItems()}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="team-equip-container">
                    {renderEquipItems()}
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

export default TeamContentCard;