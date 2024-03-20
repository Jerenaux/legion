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
  inventory: number[];
  equipments: number[];
  spells: number[];
  carrying_capacity: number;
}
interface TeamPageProps {
  matches: {
    id?: string;
  };
}
/* eslint-disable react/prefer-stateless-function */

class TeamPage extends Component<TeamPageProps, TeamPageState> { 
  state = {
    inventory: [],
    equipments: [],
    spells: [],
    carrying_capacity: 50,
  }

  componentDidMount() {
    this.fetchInventoryData();
  }

  fetchInventoryData = async () => {
    try {
        const data = await apiFetch('inventoryData');
        console.log(data);
        this.setState({ 
          inventory: [0,0,0, 1,1, 2, 3,3,3], //data.inventory.sort()
          equipments: [0,1,2],
          spells: [0,2,3],
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  render() {
    const characterId = this.props.matches.id || ''; // Fallback to empty string if ID is not present

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
              <TeamContentCard />
              <Inventory id={characterId} inventory={this.state.inventory} carrying_capacity={this.state.carrying_capacity} refreshInventory={this.fetchInventoryData} />
          </div>
        </div>
      );
  }
}

export default TeamPage;