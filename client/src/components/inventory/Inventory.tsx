
// Inventory.tsx
import { h, Component } from 'preact';
import './Inventory.style.css';
import { items } from '@legion/shared/Items';
import ActionItem from '../game/HUD/Action';
import { ActionType } from '../game/HUD/ActionTypes';

import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';
interface InventoryProps {
  id: string;
  inventory: number[];
  carrying_capacity: number;
  refreshInventory: () => void;
}

class Inventory extends Component<InventoryProps> {
  capacity = 50;

  onActionClick = (type: string, letter: string, index: number) => {
    if (!this.props.id) return;
    
    const payload = {
        index,
        characterId: this.props.id,
    };
    
    apiFetch('equipItem', {
        method: 'POST',
        body: payload
    })
    .then((data) => {
      if(data.status == 0) {
        successToast('Item equipped!');
        this.props.refreshInventory();
      } else {
        errorToast('Character inventory is full!');
      }
    })
    .catch(error => errorToast(`Error: ${error}`));
  }
  
  render() {
    const slots = Array.from({ length: this.props.carrying_capacity }, (_, i) => (
        <div key={i} className="item">
          { i < this.props.inventory.length &&
            <ActionItem 
              action={items[this.props.inventory[i]]} 
              index={i} 
              clickedIndex={-1}
              canAct={true} 
              hideHotKey={true}
              actionType={ActionType.Item}
              onActionClick={this.onActionClick}
            />
          }
        </div>
      ));
    return (
      <div className="inventoryFullContainer">
        <div className="inventoryContainer">
          <div className="inventoryCategoryContainer">
            <p className="inventoryLabel">INVENTORY</p>
            <div className="inventoryCategories">
              <div className="inventoryCategory">Home</div>
              <div className="inventoryCategory">CONSUMABLES</div>
              <div className="inventoryCategory">EQUIPMENTS</div>
              <div className="inventoryCategory">SKILLS</div>
              <div className="inventoryCategory">UTILITIES</div>
              <div className="categoryCount"><span>15 </span>&nbsp;/&nbsp;50</div>
              <div className="inventoryCategory">?</div>
            </div>
          </div>
          <div className="inventoryWrapper">{slots}</div>
        </div>
      </div>
    );
  }
}

export default Inventory;