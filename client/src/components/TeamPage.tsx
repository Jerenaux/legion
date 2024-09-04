// PlayPage.tsx
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component } from 'preact';

import Roster from './roster/Roster';
import Inventory from './inventory/Inventory';
import Skeleton from 'react-loading-skeleton';

import { apiFetch } from '../services/apiService';
import { errorToast, playSoundEffect } from './utils';
import CharacterSheet from './characterSheet/CharacterSheet';
import { APICharacterData, Effect } from '@legion/shared/interfaces';
import { EquipmentSlot, InventoryActionType, equipmentFields, Stat, statFields } from '@legion/shared/enums';
import { getEquipmentById } from '@legion/shared/Equipments';
import { inventorySize } from '@legion/shared/utils';
import { PlayerContext } from '../contexts/PlayerContext';
import { manageHelp } from './utils';
import { getSpellById } from '@legion/shared/Spells';
import { getSPIncrement } from '@legion/shared/levelling';

import equipSfx from '@assets/sfx/equip.wav';


interface TeamPageState {
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
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

  async componentDidMount() {
    await this.fetchCharacterData();
    await this.fetchInventoryData();
    manageHelp('team', this.context);
  }

  componentDidUpdate(prevProps: TeamPageProps) {
    if (prevProps.matches.id !== this.props.matches.id) {
      this.setState({ character_id: this.props.matches.id }, () => {
        this.updateCharacterData();
      });
    }
  }

  fetchInventoryData = async () => { 
    // await new Promise(resolve => setTimeout(resolve, 20000));

    try {
        const data = await apiFetch('inventoryData');
        this.setState({ 
          inventory: {
            consumables: data.inventory.consumables?.sort(),
            equipment: data.inventory.equipment?.sort(), 
            spells: data.inventory.spells?.sort(),
          },
          carrying_capacity: data.carrying_capacity
        }); 
        this.setState({ isInventoryLoaded: true }); 
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  fetchCharacterData = async () => {
    try {
        const data = await apiFetch('rosterData');

        this.setState({
          roster_data: data.characters,
          character_id: this.props.matches.id || data.characters[0].id,
        }, () => {
          this.updateCharacterData();
        });
      } catch (error) {
          errorToast(`Error: ${error}`);
      }
  }

  updateCharacterData = () => {
    const sheetData = 
      this.state.character_id ? 
      this.state.roster_data.filter((item: APICharacterData) => item.id === this.state.character_id)[0] : 
      this.state.roster_data[0];

    this.setState({
      character_sheet_data: sheetData,
    });
  }
    

  refreshCharacter = () => {
    // this.fetchCharacterData();
    // this.fetchInventoryData();
  }

  handleItemEffect = (effects: Effect[], actionType: InventoryActionType,  index?: number) => {
    // If index corresponds to left ring and actionType is 0 (equip), check if right ring slot is free
    // and if so change the slot to that
    if (index == EquipmentSlot.LEFT_RING && actionType == InventoryActionType.EQUIP) {
      if (this.state.character_sheet_data.equipment['right_ring'] === -1) {
        index = EquipmentSlot.RIGHT_RING;
      }
    }

    // get slot name from action.slot field e.g. `weapon`
    const slot = EquipmentSlot[index]?.toLowerCase();

    // if actionType is unequip, the effect value should be minus
    let real_effects = effects.map(item => ({stat: item.stat, value: actionType > 0 ? -item.value : item.value }));

    // if there's already equipped item, then get its effect
    let curr_effects = getEquipmentById(this.state.character_sheet_data.equipment[slot])?.effects;

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

  // Immediate feedback method to apply stats and SP changes without waiting for API response
  updateStats(stat: Stat, amount: number) {
    console.log('updateStats', stat, amount);
    this.setState((prevState) => {
      const newStats = { ...prevState.character_sheet_data.stats };
      newStats[statFields[stat]] += getSPIncrement(stat)*amount;
      return {
        roster_data: prevState.roster_data.map((item: APICharacterData) => {
          if (item.id === prevState.character_id) {
            return { 
              ...item, 
              stats: newStats,
              sp: item.sp - amount
            };
          }
          return item;
        })
      }
    }, () => {
      this.updateCharacterData();
    });
  }

  // Immediate feedback method to apply inventory changes without waiting for API response
  updateInventory(type: string, action: InventoryActionType, index: number) {
    switch(type) {
      case 'consumables':
        const consumables = this.state.inventory.consumables;
        if (action === InventoryActionType.EQUIP) {
          if (this.state.character_sheet_data.inventory.length >= this.state.character_sheet_data.carrying_capacity + this.state.character_sheet_data.carrying_capacity_bonus) {
            errorToast('Character inventory is full!');
            return;
          }
          const id = this.state.inventory.consumables[index];
          consumables.splice(index, 1);
          this.state.character_sheet_data.inventory.push(id);
        } else {
          if (inventorySize(this.state.inventory) >= this.state.carrying_capacity) {
            errorToast('Character inventory is full!');
            return;
          }
          const id = this.state.character_sheet_data.inventory[index];
          consumables.push(id);
          consumables.sort();
          this.state.character_sheet_data.inventory.splice(index, 1);
        }
        this.setState({ inventory: { ...this.state.inventory, consumables } });
        break;
      case 'equipment':
        const equipment = this.state.inventory.equipment;
        if (action === InventoryActionType.EQUIP) {
          const data = getEquipmentById(equipment[index]);

          if (data.minLevel > this.state.character_sheet_data.level) {
            errorToast('Character level is too low!');
            return;
          }

          if (data.classes.length && !data.classes.includes(this.state.character_sheet_data.class)) {
            errorToast('Character class is not compatible!');
            return;
          }

          let slotNumber = data.slot;

          if (slotNumber === EquipmentSlot.LEFT_RING 
            && this.state.character_sheet_data.equipment['left_ring'] > -1
            && this.state.character_sheet_data.equipment['right_ring'] == -1) {
              slotNumber = EquipmentSlot.RIGHT_RING;
          }

          const field = equipmentFields[slotNumber];
          const id = equipment[index];
          equipment.splice(index, 1);

          if (this.state.character_sheet_data.equipment[field] !== -1) {
            const removed_id = this.state.character_sheet_data.equipment[field];
            equipment.push(removed_id);
            equipment.sort();
          }

          this.state.character_sheet_data.equipment[field] = id;
        } else {
          if (inventorySize(this.state.inventory) >= this.state.carrying_capacity) {
            errorToast('Character inventory is full!');
            return;
          }
          const field = equipmentFields[index];
          const id = this.state.character_sheet_data.equipment[field];
          this.state.character_sheet_data.equipment[field] = -1;
          equipment.push(id);
          equipment.sort();
        }
        this.setState({ inventory: { ...this.state.inventory, equipment } });
        break;
      case 'spells':
        const playerSpells = this.state.inventory.spells;
        if (action === InventoryActionType.EQUIP) {
          const data = getSpellById(playerSpells[index]);
          if (data.classes.length && !data.classes.includes(this.state.character_sheet_data.class)) {
            errorToast('Character class is not compatible!');
            return;
          }
          if (data.minLevel > this.state.character_sheet_data.level) {
            errorToast('Character level is too low!');
            return;
          }

          if (this.state.character_sheet_data.skill_slots == 0) {
            errorToast('Character has no spell slots!');
            return;
          }
          if (this.state.character_sheet_data.skills.length >= this.state.character_sheet_data.skill_slots) {
            errorToast('Character spell slots are full!');
            return;
          }
          const id = this.state.inventory.spells[index];
          // Check if character already knows the spell
          if (this.state.character_sheet_data.skills.includes(id)) {
            errorToast('Character already knows this spell!');
            return;
          }
          playerSpells.splice(index, 1);
          this.state.character_sheet_data.skills.push(id);
        }
        this.setState({ inventory: { ...this.state.inventory, spells: playerSpells } });
        break;
    }
    playSoundEffect(equipSfx);
  }

  render() {

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
            {this.state.character_sheet_data ? <CharacterSheet 
              characterId={this.state.character_id} 
              characterData={this.state.character_sheet_data} 
              itemEffects={this.state.statsModifiers}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
              updateInventory={this.updateInventory.bind(this)}
              updateStats={this.updateStats.bind(this)} 
              selectedEquipmentSlot={this.state.selectedEquipmentSlot} 
              handleSelectedEquipmentSlot={this.handleSelectedEquipmentSlot} 
            /> : <Skeleton 
            height={400} 
            count={1} 
            highlightColor='#0000004d' 
            baseColor='#0f1421' 
            style={{margin: '2px 0', width: '434px'}}/>}

            {this.state.character_sheet_data ? <Inventory 
              id={this.state.character_id} 
              name={this.state.character_sheet_data.name} 
              level={this.state.character_sheet_data.level} 
              class={this.state.character_sheet_data.class} 
              inventory={this.state.inventory} 
              carrying_capacity={this.state.carrying_capacity}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
              updateInventory={this.updateInventory.bind(this)} 
              handleSelectedEquipmentSlot={this.handleSelectedEquipmentSlot} 
              isInventoryLoaded={this.state.isInventoryLoaded} 
            /> : <Skeleton 
            height={297} 
            count={1} 
            highlightColor='#0000004d' 
            baseColor='#0f1421' 
            style={{margin: '2px 0', width: '560px'}}/>}
          </div>
        </div>
      );
  }
}

export default TeamPage;