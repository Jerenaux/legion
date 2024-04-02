// TeamContentCard.tsx
import { h, Component } from 'preact';
import { useMemo } from 'react';
import './TeamContentCard.style.css';
import { errorToast, classEnumToString } from '../utils';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { equipments } from '@legion/shared/Equipments';
import { spells } from '@legion/shared/Spells';
import { items } from '@legion/shared/Items';
import { apiFetch } from '../../services/apiService';
import { CHARACTER_INFO, INFO_BG_COLOR, INFO_TYPE, ItemDialogType } from '../itemDialog/ItemDialogType';
import ItemDialog from '../itemDialog/ItemDialog';

interface InventoryRequestPayload {
    characterId: string;
    handleCharacterId: (id: string) => void;
    refreshInventory: () => void;
}

class TeamContentCard extends Component<InventoryRequestPayload> {
    state = {
        character: null,
        characterItems: [],
        itemIndex: 0,
        openModal: false,
        modalType: ItemDialogType.EQUIPMENTS,
        modalData: null,
        modalPosition: {
            top: 0,
            left: 0
        },
    }

    componentDidMount() {
        this.fetchCharacterData();
    }

    async fetchCharacterData() {
        try {
            const data = await apiFetch('rosterData');

            this.setState({
                character: this.props.characterId ? data.characters.filter((item: any) => item.id === this.props.characterId)[0] : data.characters[0],
            });

            this.props.handleCharacterId(data.characters[0].id);
        } catch (error) {
            errorToast(`Error: ${error}`);
        }
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
    }

    render() {
        console.log('_____ character data _______', this.state.character);

        const renderInfoBars = () => {
            if (!this.state.character) return;

            const order = ['hp', 'mp', 'atk', 'def', 'spatk', 'spdef'];
            const items = Object.entries(this.state.character.stats).map(([key, value]) => ({ key, value: value as number }));
            const rearrangedItems = order.map(key => items.find(item => item.key === key));

            return rearrangedItems.map((item, index) => (
                <div className="character-info-bar" key={index}>
                    <div className="info-class" style={{ backgroundColor: INFO_BG_COLOR[INFO_TYPE[item.key]] }}><span>{INFO_TYPE[item.key]}</span></div>
                    <p className="curr-info">{item.value}
                        {/* <span style={item.additionVal && Number(item.additionVal) > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{item.additionVal}</span> */}
                    </p>
                    {this.state.character?.sp > 0 && <button className="info-bar-plus" onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.CHARACTER_INFO, index)}></button>}
                </div>
            ));
        };

        const renderEquipItems = () => {
            if (!this.state.character) return;
            const items = Object.entries(this.state.character.equipment).map(([key, value]) => ({ key, value: value as number })); // for equipments of right hand

            return items.slice(0, 6).map((item, index) => (
                <div className="equip-item" key={index} onClick={(e) => this.handleOpenModal(e, equipments[index], ItemDialogType.EQUIPMENTS, index)}>
                    <img src={item.value > 0 ? `/equipment/${equipments[index].frame}` : `/inventory/${item.key}_icon.png`} alt={item.key} />
                </div>
            ))
        }

        const renderCharacterItems = useMemo(() => {
            if (!this.state.character) return;

            const items = Object.entries(this.state.character.equipment).map(([key, value]) => ({ key, value: value as number })).slice(6, 9);

            return items.map((item, index) => (
                <div className="equip-item sheet-item" key={index} onClick={(e) => this.handleOpenModal(e, equipments[index + 6], ItemDialogType.EQUIPMENTS, index + 6)}>
                    <img style={item.value < 0 && { transform: 'scaleY(0.6)' }} src={item.value > 0 ? `/equipment/${equipments[index + 6].frame}` : `/inventory/${item.key}_icon.png`} alt={item.key} />
                </div>
            ))
        }, [this.state.character]);


        const renderSpellsItem = () => {
            if (!this.state.character) return;

            return Array.from({ length: 6 }, (_, i) => (
                i < this.state.character.skills.length ? (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, spells[this.state.character.skills[i]], ItemDialogType.SKILLS, i)}>
                        <img src={`/spells/${spells[this.state.character.skills[i]].frame}`} alt={spells[this.state.character.skills[i]].name} />
                    </div>
                ) : (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, spells[this.state.character.skills[i]], ItemDialogType.SKILLS, i)}>
                    </div>
                )
            ))
        };

        const renderConsumableItems = () => {
            if (!this.state.character) return;

            return Array.from({ length: 6 }, (_, i) => (
                i < this.state.character.inventory.length ? (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, items[this.state.character.inventory[i]], ItemDialogType.CONSUMABLES, i)}>
                        <img src={`/consumables/${items[this.state.character.inventory[i]].frame}`} alt={items[this.state.character.inventory[i]].name} />
                    </div>
                ) : (
                    <div className="team-item" key={i} onClick={(e) => this.handleOpenModal(e, items[this.state.character.inventory[i]], ItemDialogType.CONSUMABLES, i)}>
                    </div>
                )
            ))
        };

        const portraitStyle = {
            backgroundImage: `url(/sprites/${this.state.character?.portrait ?? '1_1'}.png)`,
        };

        return (
            <div className="team-content-card-container">
                <div className="team-content-container">
                    <div className="team-level">
                        <span>Lv</span>
                        <span className="level-span">{this.state.character?.level}</span>
                    </div>
                    <div className="team-info-container">
                        <div className="team-info">
                            <p className="team-character-name">{this.state.character?.name}</p>
                            <p className="team-character-class">{classEnumToString(this.state.character?.class)}</p>
                            <div className="team-exp-slider-container">
                                <div className="team-curr-exp-slider"></div>
                            </div>
                            <div className="team-exp-info">
                                <span>EXP <span className="team-curr-exp">980.200</span> / <span className="team-total-exp">1.600.0000</span></span>
                            </div>
                        </div>
                        <div className="team-sp-container">
                            <span>SP</span>
                            <span className="sp-span">{this.state.character?.sp}</span>
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
                <ItemDialog  refreshInventory={this.props.refreshInventory} characterId={this.props.characterId} index={this.state.itemIndex} dialogOpen={this.state.openModal} dialogType={this.state.modalType} position={this.state.modalPosition} dialogData={this.state.modalData} handleClose={this.handleCloseModal} />
            </div>
        );
    }
}

export default TeamContentCard;