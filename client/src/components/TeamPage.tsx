// PlayPage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';

import Roster from './roster/Roster';
import Character from './Character';
import Inventory from './inventory/Inventory';

import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import TeamContentCard from './teamContentCard/TeamContentCard';
import { Effect } from '@legion/shared/interfaces';
import { EquipmentSlot, InventoryActionType } from '@legion/shared/enums';
import { equipments } from '@legion/shared/Equipments';

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

  render() {

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
            <TeamContentCard 
              characterId={this.state.character_id} 
              characterData={this.state.character_sheet_data} 
              itemEffects={this.state.item_effect}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
            />
            <Inventory 
              id={this.state.character_id} 
              inventory={this.state.inventory} 
              carrying_capacity={this.state.carrying_capacity}
              refreshCharacter={this.refreshCharacter} 
              handleItemEffect={this.handleItemEffect}
            />
          </div>
        </div>
      );
  }
}

export default TeamPage;