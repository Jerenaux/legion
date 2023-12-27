
// Inventory.tsx
import { h, Component } from 'preact';
import firebase from 'firebase/compat/app'
import firebaseConfig from '@legion/shared/firebaseConfig';
firebase.initializeApp(firebaseConfig);

import { items } from '@legion/shared/Items';
import ActionItem from './game/HUD/Action';
import { ActionType } from './game/HUD/ActionTypes';


interface InventoryState {
    user: firebase.User | null;
    capacity: number;
    inventory: number[];
  }

class Inventory extends Component<object, InventoryState> {
  authSubscription: firebase.Unsubscribe | null = null;
  capacity = 50;
  constructor(props: object) {
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
          this.fetchInventoryData(this.state.user); 
        }
      });
    });
  }

  componentWillUnmount() {
    // Don't forget to unsubscribe when the component unmounts
    this.authSubscription();
  }
  
  async fetchInventoryData(user) {
    user.getIdToken(true).then((idToken) => {
      // Make the API request, including the token in the Authorization header
      fetch(`${process.env.PREACT_APP_API_URL}/inventoryData`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        this.setState({ 
          inventory: data.inventory.sort()
        });
      })
      .catch(error => console.error('Error:', error));
    }).catch((error) => {
      console.error(error);
    });
  }

  onActionClick = (type: string, letter: string, index: number) => {
    console.log('clicked', index);
    this.state.user.getIdToken(true).then((idToken) => {
      // Make the API request, including the token in the Authorization header
      fetch(`${process.env.PREACT_APP_API_URL}/equipItem`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: selectedItem.id,
          quantity,
        }),
      })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        this.setState({ 
          gold: data.gold,
          inventory: data.inventory
        });
        toast.info('Purchase successful!', {closeBtn: false, position: 'top', duration: 3000});
      })
      .catch(error => console.error('Error:', error));
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
              onActionClick={this.onActionClick}
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