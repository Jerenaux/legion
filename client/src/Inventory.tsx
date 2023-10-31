
// Inventory.tsx
import { h, Component } from 'preact';
import axios from 'axios';
import firebase from './firebaseConfig';

import { items } from '@legion/shared/Items';
import ActionItem from './game/HUD/Action';
import { ActionType } from './game/HUD/ActionTypes';

interface InventoryProps {
  // Define your props here
}

interface InventoryState {
    user: firebase.User | null;
    capacity: number;
    inventory: number[];
  }

class Inventory extends Component<InventoryProps, InventoryState> {
  authSubscription: firebase.Unsubscribe | null = null;
  capacity = 50;
  constructor(props: InventoryProps) {
      super(props);
      this.state = {
          user: null,
          capacity: this.capacity,
          inventory: []
      };
  }

  componentDidMount() {
    this.authSubscription = firebase.auth().onAuthStateChanged((user) => {
      this.setState({ user }, () => {
        if (user) {
          console.log('User is logged in');
          this.fetchInventoryData(); // Assuming this is where you put your fetch logic
        }
      });
    });
  }

  componentWillUnmount() {
    // Don't forget to unsubscribe when the component unmounts
    this.authSubscription();
  }
  
  async fetchInventoryData() {
    this.state.user.getIdToken(true).then((idToken) => {
      console.log(idToken);
      const API_URL = 'http://127.0.0.1:5010/legion-32c6d/us-central1';
      // Make the API request, including the token in the Authorization header
      fetch(`${API_URL}/inventoryData?playerId=0`, {
        headers: {
          'Authorization': 'Bearer ' + idToken,
        },
      })
      .then(response => response.json())
      .then(data => {
        this.setState({ inventory: data });
      })
      .catch(error => console.error('Error:', error));
    }).catch((error) => {
      console.error(error);
    });
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