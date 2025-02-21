// PlayPage.tsx
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component, createRef } from 'preact';

import Roster from './roster/Roster';
import Inventory from './inventory/Inventory';
import Skeleton from 'react-loading-skeleton';

import CharacterSheet from './characterSheet/CharacterSheet';
import { APICharacterData, Effect } from '@legion/shared/interfaces';
import { EquipmentSlot, InventoryActionType } from '@legion/shared/enums';
import { getEquipmentById } from '@legion/shared/Equipments';
import { PlayerContext } from '../contexts/PlayerContext';
import PopupManager, { Popup } from './popups/PopupManager';

interface TeamPageState {
  carrying_capacity: number;
  roster_data: APICharacterData[];
  character_id: string;
  character_sheet_data: APICharacterData;
  statsModifiers: Effect[]; 
  selectedEquipmentSlot: number; 
  isInventoryLoaded: boolean; 
}
interface TeamPageProps {
  matches: {
    id?: string;
  };
}
/* eslint-disable react/prefer-stateless-function */

class TeamPage extends Component<TeamPageProps, TeamPageState> { 
  static contextType = PlayerContext; 

  state = {
    inventory: {
      consumables: [],
      equipment: [],
      spells: [], 
    },
    carrying_capacity: 0,
    character_id: this.props.matches.id || '',
    character_sheet_data: null,
    statsModifiers: [], 
    selectedEquipmentSlot: -1, 
    isInventoryLoaded: false, 
    roster_data: [],
  } 

  handleSelectedEquipmentSlot = (newValue) => { 
    this.setState({ selectedEquipmentSlot: newValue }); 
  }

  popupManagerRef = createRef();

  async componentDidMount() {
    if (this.context.characters.length === 0) {
      await this.context.fetchRosterData();
    }
    await this.updateCharacterData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.matches.id !== this.props.matches.id || this.context.characterSheetIsDirty) {
      this.updateCharacterData();
    }

    if (this.context.player.isLoaded) {
      this.popupManagerRef.current?.hidePopup();
      if (
          !this.context.checkEngagementFlag('everEquippedConsumable') 
          && this.context.hasConsumable()
          && this.context.getCompletedGames() < 5
        ) {
        this.popupManagerRef.current?.enqueuePopup(Popup.EquipConsumable);
      } else if (
        !this.context.checkEngagementFlag('everEquippedEquipment') && 
        this.context.hasEquipableEquipment()
      ) {
        const equipmentId = this.context.getEquipmentThatCurrentCharacterCanEquip();
        if (equipmentId != undefined) {
          this.popupManagerRef.current?.enqueuePopup(Popup.EquipEquipment); 
        } else {
          const character = this.context.getCharacterThatCanEquipEquipment();
          if (character) {
            this.popupManagerRef.current?.enqueuePopup(Popup.SwitchCharacterForEquipment); 
          }
        }
      } else if (
        !this.context.checkEngagementFlag('everEquippedSpell') && 
        this.context.hasEquipableSpells()
      ) {
        const spellId = this.context.getSpellsThatCurrentCharacterCanEquip();
        if (spellId != undefined) {
          this.popupManagerRef.current?.enqueuePopup(Popup.EquipSpell);
        } else {
          const character = this.context.getCharacterThatCanEquipSpells();
          if (character) {
            this.popupManagerRef.current?.enqueuePopup(Popup.SwitchCharacterForSpell); 
          }
        }
      } else if (
        !this.context.checkEngagementFlag('everSpentSP') && 
        this.context.hasAnyCharacterSpendableSP()
      ) {
        if (this.context.hasCurrentCharacterSpendableSP()) {
          console.log('Enqueuing SpendSP popup');
          this.popupManagerRef.current?.enqueuePopup(Popup.SpendSP);
        } else {
          console.log('Enqueuing SwitchCharacterForSP popup');
          this.popupManagerRef.current?.enqueuePopup(Popup.SwitchCharacterForSP);
        }
      }
    }
  }

  updateCharacterData = () => {
    if (!this.context.characters.length) return;
    const characterData = this.context.getCharacter(this.context.activeCharacterId || this.context.characters[0].id);
    this.setState({ character_sheet_data: characterData });
    this.context.characterSheetIsDirty = false;
  }

  handleItemEffect = (effects: Effect[], actionType: InventoryActionType,  index?: number) => {
    // If index corresponds to left ring and actionType is 0 (equip), check if right ring slot is free
    // and if so change the slot to that
    if (index == EquipmentSlot.LEFT_RING && actionType == InventoryActionType.EQUIP) {
      if (this.context.getActiveCharacter().equipment['right_ring'] === -1) {
        index = EquipmentSlot.RIGHT_RING;
      }
    }

    // get slot name from action.slot field e.g. `weapon`
    const slot = EquipmentSlot[index]?.toLowerCase();

    // if actionType is unequip, the effect value should be minus
    let real_effects = effects.map(item => ({stat: item.stat, value: actionType > 0 ? -item.value : item.value }));

    // if there's already equipped item, then get its effect
    let curr_effects = getEquipmentById(this.context.getActiveCharacter().equipment[slot])?.effects;

    let result_effects = real_effects;
    
    if(curr_effects) {
      // we need to remove current equipped item, so its effect value display minus
      curr_effects = curr_effects.map(item => ({stat: item.stat, value: -item.value}));

      // the total effect of un-equipping current item and equipping new one
      result_effects = [...curr_effects, ...real_effects].reduce((acc, obj) => {
        const existingObj = acc.find(item => item.stat === obj.stat);
        if (existingObj) {
          existingObj.value += obj.value;
        } else {
          acc.push({ stat: obj.stat, value: obj.value });
        }
        return acc;
      }, []);
    }

    this.setState({statsModifiers: result_effects});
  }

  render() {
    return (
      <div className="team-page">
        <PopupManager 
          ref={this.popupManagerRef}
          onPopupResolved={() => {}}
        />
        <Roster/>
        <div className="character-inventory-container">
          {this.context.player.isLoaded ? <CharacterSheet 
            itemEffects={this.state.statsModifiers}
            handleItemEffect={this.handleItemEffect}
            selectedEquipmentSlot={this.state.selectedEquipmentSlot} 
            handleSelectedEquipmentSlot={this.handleSelectedEquipmentSlot} 
            updateCharacterData={this.updateCharacterData}
          /> : <Skeleton 
          height={400} 
          count={1} 
          highlightColor='#0000004d' 
          baseColor='#0f1421' 
          className="character-sheet-skeleton"/>}

          {this.context.player.isLoaded ? <Inventory 
            handleItemEffect={this.handleItemEffect}
            handleSelectedEquipmentSlot={this.handleSelectedEquipmentSlot} 
          /> : <Skeleton 
          height={297} 
          count={1} 
          highlightColor='#0000004d' 
          baseColor='#0f1421' 
          className="inventory-skeleton"/>}
        </div>
      </div>
    );
  }
}

export default TeamPage;