// PlayPage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';

import Roster from './roster/Roster';
import Character from './Character';
import Inventory from './inventory/Inventory';

import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';
import TeamContentCard from './teamContentCard/TeamContentCard';

interface TeamPageState {
  inventory: {
    consumables: number[];
    equipment: number[];
    spells: number[];
  };
  carrying_capacity: number;
  curr_characterId?: string;
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
    curr_characterId: ''
  }

  componentDidMount() {
    this.fetchInventoryData();
  }

  handleCurrentCharacterId = (currId: string) => {
    this.setState({curr_characterId: currId})
  }

  fetchInventoryData = async () => {
    try {
        const data = await apiFetch('inventoryData');
        console.log(data);
        this.setState({ 
          inventory: {
            consumables: data.inventory.consumables.sort(),
            equipment: data.inventory.equipment.sort(), 
            spells: data.inventory.spells.sort(),
          },
          carrying_capacity: data.carrying_capacity
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  render() {
    const characterId = this.props.matches.id || this.state.curr_characterId; // Fallback to empty string if ID is not present

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
            <TeamContentCard handleCharacterId={this.handleCurrentCharacterId} characterId={characterId} refreshInventory={this.fetchInventoryData} />
            <Inventory id={characterId} inventory={this.state.inventory} carrying_capacity={this.state.carrying_capacity} refreshInventory={this.fetchInventoryData} />
          </div>
        </div>
      );
  }
}

export default TeamPage;