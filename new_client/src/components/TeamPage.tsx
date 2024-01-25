// PlayPage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';

import Roster from './Roster';
import Character from './Character';
import Inventory from './Inventory';

// import toast from '@brenoroosevelt/toast'
import { apiFetch } from '../services/apiService';

interface TeamPageState {
  inventory: number[];
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
          inventory: data.inventory.sort()
        });
    } catch (error) {
        // toast.error(`Error: ${error}`, {closeBtn: true, position: 'top'});
    }
  }

  render() {
    const characterId = this.props.matches.id || ''; // Fallback to empty string if ID is not present

    return (
        <div className="team-content">
          <Roster />
          <div className="character-inventory-container">
            <Router>
              <Route path="/team/:id" component={() => <Character id={characterId} refreshInventory={this.fetchInventoryData} />} />
            </Router>
            <Inventory id={characterId} inventory={this.state.inventory} carrying_capacity={this.state.carrying_capacity} refreshInventory={this.fetchInventoryData} />
          </div>
        </div>
      );
  }
}

export default TeamPage;