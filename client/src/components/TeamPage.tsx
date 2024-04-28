// PlayPage.tsx
import 'react-loading-skeleton/dist/skeleton.css'

import { h, Component } from 'preact';

import Roster from './roster/Roster';
import Inventory from './inventory/Inventory';
import Skeleton from 'react-loading-skeleton';

import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import TeamContentCard from './teamContentCard/TeamContentCard';
import { Effect } from '@legion/shared/interfaces';
import { EquipmentSlot, InventoryActionType, equipmentFields } from '@legion/shared/enums';
import { equipments } from '@legion/shared/Equipments';
import { items } from '@legion/shared/Items';
import { spells } from '@legion/shared/Spells';
import { inventorySize } from '@legion/shared/utils';
interface TeamPageState {
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
  carrying_capacity: number;
  character_id: string;
  character_sheet_data: any;
  item_effect: Effect[];
}
interface TeamPageProps {
  matches: {
    id?: string;
  };
}
/* eslint-disable react/prefer-stateless-function */

class TeamPage extends Component<TeamPageProps, TeamPageState> { 
  state = {
    inventory: {
      consumables: [],
      equipment: [],
      spells: [],
    },
    carrying_capacity: 0,
    character_id: this.props.matches.id || '',
    character_sheet_data: null,
    item_effect: [],
  }

  componentDidMount() {
    this.fetchCharacterData();
    this.fetchInventoryData();
  }

  fetchInventoryData = async () => {
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
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  fetchCharacterData = async () => {
    try {
        const data = await apiFetch('rosterData');
        const sheetData = this.state.character_id ? data.characters.filter((item: any) => item.id === this.state.character_id)[0] : data.characters[0];

        this.setState({
          character_sheet_data: sheetData,
          character_id: sheetData.id,
        });
      } catch (error) {
          errorToast(`Error: ${error}`);
      }
  }

  refreshCharacter = () => {
    this.fetchCharacterData();
    this.fetchInventoryData();
  }

  handleItemEffect = (effects: Effect[], actionType: InventoryActionType,  index?: number) => {
    // get slot name from action.slot field e.g. `weapon`
    const slot = EquipmentSlot[index]?.toLowerCase();

    // if actionType is unequip, the effect value should be minus
    let real_effects = effects.map(item => ({stat: item.stat, value: actionType > 0 ? -item.value : item.value }));

    // if there's already equipped item, then get its effect
    let curr_effects = equipments[this.state.character_sheet_data.equipment[slot]]?.effects;

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

    this.setState({item_effect: result_effects});
  }

  

  updateInventory(type: string, action: InventoryActionType, index: number) {
    switch(type) {
      case 'consumables':
        const consumables = this.state.inventory.consumables;
        if (action === InventoryActionType.EQUIP) {
          if (this.state.character_sheet_data.inventory.length >= this.state.character_sheet_data.carrying_capacity + this.state.character_sheet_data.carrying_capacity_bonus) {
            errorToast('Character inventory is full!');
            return;
          }
          const id = items[this.state.inventory.consumables[index]].id;
          consumables.splice(index, 1);
          this.state.character_sheet_data.inventory.push(id);
        } else {
          if (inventorySize(this.state.inventory) >= this.state.carrying_capacity) {
            errorToast('Character inventory is full!');
            return;
          }
          const id = items[this.state.character_sheet_data.inventory[index]].id;
          consumables.push(id);
          consumables.sort();
          this.state.character_sheet_data.inventory.splice(index, 1);
        }
        this.setState({ inventory: { ...this.state.inventory, consumables } });
        break;
      case 'equipment':
        const equipment = this.state.inventory.equipment;
        if (action === InventoryActionType.EQUIP) {
          const data = equipments[equipment[index]];
          const slotNumber = data.slot;
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
          if (this.state.character_sheet_data.skill_slots == 0) {
            errorToast('Character has no spell slots!');
            return;
          }
          if (this.state.character_sheet_data.skills.length >= this.state.character_sheet_data.skill_slots) {
            errorToast('Character spell slots are full!');
            return;
          }
          const id = spells[this.state.inventory.spells[index]].id;
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
  }

  render() {

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
            {this.state.character_sheet_data ? <TeamContentCard 
              characterId={this.state.character_id} 
              characterData={this.state.character_sheet_data} 
              itemEffects={this.state.item_effect}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
              updateInventory={this.updateInventory.bind(this)}
            /> : <Skeleton 
            height={400} 
            count={1} 
            highlightColor='#0000004d' 
            baseColor='#0f1421' 
            style={{margin: '2px 0', width: '434px'}}/>}

            {this.state.character_sheet_data ? <Inventory 
              id={this.state.character_id} 
              inventory={this.state.inventory} 
              carrying_capacity={this.state.carrying_capacity}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
              updateInventory={this.updateInventory.bind(this)}
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