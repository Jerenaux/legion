// TeamContentCard.tsx
import ItemDialog from '../itemDialog/ItemDialog';
import { CHARACTER_INFO, CONSUMABLE, EQUIPMENT, INFO_BG_COLOR, ItemDialogType, SPELL } from '../itemDialog/ItemDialogType';
import './TeamContentCard.style.css';
import { h, Component } from 'preact';
import { CHARACTERINFO, CONSUMABLEITEMS, EQUIPITEMS, EQUIPITEMS_DEFAULT, SPELLITEMS } from './TeamContentCardData';
import { apiFetch } from '../../services/apiService';
import {InventoryType, InventoryActionType} from "@legion/shared/enums";
import { successToast, errorToast } from './utils';

interface InventoryRequestPayload {
    characterId: string;
    inventoryType: InventoryType;
    action: InventoryActionType;
    index: number;
}

class TeamContentCard extends Component {
    state = {
        openModal: false,
        modalType: ItemDialogType.EQUIPMENTS,
        modalData: null,
        modalPosition: {
            top: 0,
            left: 0
        }
    }

    onClick = (index: number) => {
        const payload: InventoryRequestPayload = {
            // specify fields here
        };
        
        apiFetch('inventoryTransaction', {
            method: 'POST',
            body: payload
        })
        .then((data) => {
          if(data.status == 0) {
            successToast('...');
            // refresh inventory
          } else {
            errorToast('Inventory is full!');
          }
        })
        .catch(error => errorToast(`Error: ${error}`));
    }

    handleOpenModal = (e: any, modalData: EQUIPMENT | CONSUMABLE | CHARACTER_INFO | SPELL, modalType: string) => {
        if (!modalData.name) return;
        const elementRect = e.currentTarget.getBoundingClientRect();

        const modalPosition = {
            top: elementRect.top + elementRect.height / 2,
            left: elementRect.left + elementRect.width / 2,
        };

        this.setState({openModal: true, modalType, modalPosition, modalData});
    }

    handleCloseModal = () => {
        this.setState({openModal: false});
    }

    render() {
        const renderInfoBars = () => CHARACTERINFO.map((item, index) => (
            <div className="character-info-bar" key={index} onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.CHARACTER_INFO)}>
                <div className="info-class" style={{backgroundColor: INFO_BG_COLOR[item.name]}}><span>{item.name}</span></div>
                <p className="curr-info">{item.currVal} <span style={item.additionVal && Number(item.additionVal) > 0 ? { color: '#9ed94c' } : { color: '#c95a74' }}>{item.additionVal}</span></p>
                <button className="info-bar-plus"></button>
            </div>
        ));

        const renderEquipItems = () => EQUIPITEMS.map((item, index) => (
            <div className="equip-item" key={index} onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.EQUIPMENTS)}>
                <img src={item.url ? item.url : EQUIPITEMS_DEFAULT[index].url} alt={item.name} />
            </div>
        ))

        const renderSpellsItem = () => SPELLITEMS.map((item, index) => (
            <div className="team-item" key={index} onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.SKILLS)}>
                {item.url && <img src={item.url} alt={item.name} />}
            </div>
        ));

        const renderConsumableItems = () => CONSUMABLEITEMS.map((item, index) => (
            <div className="team-item" key={index} onClick={(e) => this.handleOpenModal(e, item, ItemDialogType.CONSUMABLES)}>
                {item.url && <img src={item.url} alt={item.name} />}
            </div>
        ));

        return (
            <div className="team-content-card-container">
                <div className="team-content-container">
                    <div className="team-level">
                        <span>Lv</span>
                        <span className="level-span">10</span>
                    </div>
                    <div className="team-info-container">
                        <div className="team-info">
                            <p className="team-character-name">Alternative_Gray</p>
                            <p className="team-character-class">WARRIOR</p>
                            <div className="team-exp-slider-container">
                                <div className="team-curr-exp-slider"></div>
                            </div>
                            <div className="team-exp-info">
                                <span>EXP <span className="team-curr-exp">980.200</span> / <span className="team-total-exp">1.600.0000</span></span>
                            </div>
                        </div>
                        <div className="team-sp-container">
                            <span>SP</span>
                            <span className="sp-span">3</span>
                        </div>
                    </div>
                    <div className="team-character-info-container">
                        <div className="team-character-container">
                            <div className="team-character"></div>
                        </div>
                        <div className="team-character-info">
                            {renderInfoBars()}
                        </div>
                    </div>
                    <div className="team-items-container">
                        <div className="character-icon-container">
                            <div className="character-icon">
                                <img src="./inventory/ring_icon.png" alt="" />
                            </div>
                            <div className="character-icon">
                                <img src="./inventory/ring_icon.png" alt="" />
                            </div>
                            <div className="character-icon necklace">
                                <img src="./inventory/necklace_icon.png" alt="" />
                            </div>
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
                <ItemDialog dialogOpen={this.state.openModal} dialogType={this.state.modalType} position={this.state.modalPosition} dialogData={this.state.modalData} handleClose={this.handleCloseModal} />
            </div>
        );
    }
}

export default TeamContentCard;