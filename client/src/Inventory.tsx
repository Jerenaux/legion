
// Inventory.tsx
import { h, Component } from 'preact';
import axios from 'axios';

import { items } from '@legion/shared/Items';
import ActionItem from './game/HUD/Action';
import { ActionType } from './game/HUD/ActionTypes';

interface InventoryProps {
  // Define your props here
}

interface InventoryState {
    capacity: number;
    inventory: number[];
  }

class Inventory extends Component<InventoryProps, InventoryState> {
  capacity = 50;
  constructor(props: InventoryProps) {
      super(props);
      this.state = {
          capacity: this.capacity,
          inventory: []
      };
  }

  async componentDidMount() {
    const API_URL = 'http://127.0.0.1:5010/legion-32c6d/us-central1';
    const response = await axios.get(`${API_URL}/inventoryData?playerId=1`);
    if (response.data) this.setState({ inventory: response.data });
  }
  render() {
    const slots = Array.from({ length: this.state.capacity }, (_, i) => (
        <div key={i} className="item">
          { i < this.state.inventory.length &&
            <ActionItem 
              action={items[this.state.inventory[i]]} 
              index={i} 
              clickedIndex={-1}
              canAct={true} 
              hideHotKey={true}
              actionType={ActionType.Item}
            />
          }
        </div>
      ));
    return (
        <div className="inventory-full">
        <div className="inventory-header">
            <img src="/assets/backpacks.png" className="inventory-header-image" />
            <div className="inventory-header-name">
              Inventory
              <span className="inventory-capacity">{this.state.inventory.length}/{this.state.capacity}</span>
            </div>
            <div className="inventory-header-name-shadow">Inventory</div>
        </div>
        <div className="inventory-full-content">
            {slots}
        </div>
      </div>
    );
  }
}

export default Inventory;