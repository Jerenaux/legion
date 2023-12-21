// ShopPage.tsx
import { h, Component } from 'preact';
import Description from './Description';
import { items } from '@legion/shared/Items';
import firebase from '@legion/shared/firebaseConfig';

interface State {
  user: firebase.User | null;
  gold: number;
  items: Array<any>;
  isDialogOpen: boolean;
  selectedItem: any;
  quantity: number;
}

class ShopPage extends Component<object, State> {
  authSubscription: firebase.Unsubscribe | null = null;

  state: State = {
    user: null,
    gold: 0,
    items,
    isDialogOpen: false,
    selectedItem: null,
    quantity: 1,
  };

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
        this.setState({ gold: data.gold });
      })
      .catch(error => console.error('Error:', error));
    }).catch((error) => {
      console.error(error);
    });
  }

  openDialog = (item) => {
    this.setState({ isDialogOpen: true, selectedItem: item, quantity: 1 });
  }

  closeDialog = () => {
    this.setState({ isDialogOpen: false, selectedItem: null });
  }

  changeQuantity = (amount) => {
    this.setState((prevState) => {
      // Ensure quantity does not go below 1
      const newQuantity = prevState.quantity + amount;
      return { 
        quantity: newQuantity >= 1 ? newQuantity : 1 
      };
    });
  }

  purchaseItem = () => {
    // handle the purchase here
    this.closeDialog();
  }

  render() {
    const { isDialogOpen, selectedItem, quantity } = this.state;
    const totalPrice = selectedItem ? selectedItem.price * quantity : 0;
    return (
      <div>
        <div className="page-header">
          <img src="assets/shop.png" className="page-icon" />
          <h1 className="page-title">Shop</h1>
        </div>
        <div className="shop-content">
            <div className="gold-container" title='Your gold'>
                <img src="assets/gold2.png" className="gold-icon" /> {/* Replace with your gold icon */}
                <span>{this.state.gold}</span>
            </div>

            <div className="shop-grid">
              {this.state.items.map((item) => (
                <div key={item.id} className="shop-item-card" onClick={() => this.openDialog(item)}>
                  <div className="shop-item-card-header">
                    <div className="shop-item-card-name">{item.name}</div>
                    <div className="shop-item-card-name-shadow">{item.name}</div>
                  </div>
                  <div className="shop-item-card-content">
                    <div style={{ backgroundImage: `url(/assets/items/${item.frame})` }} className="shop-item-image" />
                    <div className="shop-item-card-content-info">
                      <div className="shop-item-details">
                        {item.description}
                        <Description action={item} />
                      </div>
                      <div className="shop-item-card-capsules">
                        <div className="shop-item-card-owned" title='Amount Owned'>23</div>
                        <div className="shop-item-card-price" title='Price'>{item.price}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {isDialogOpen && (
          <div className="dialog">
            <div className="shop-item-card-header">
              <div className="shop-item-card-name">Buy</div>
              <div className="shop-item-card-name-shadow">Buy</div>
            </div>
            <div className="shop-item-card-content">
            <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeDialog} />
              <div className="purchase-dialog">
                <div className="purchase-item">
                  <span className="purchase-item-name">{selectedItem.name} x</span>
                  <div className="purchase-quantity-selector">
                    <button className="purchase-adjust purchase-minus" onClick={() => this.changeQuantity(-1)}>-</button>
                    <input type="text" className="purchase-quantity" value={quantity} />
                    <button className="purchase-adjust  purchase-plus" onClick={() => this.changeQuantity(1)}>+</button>
                  </div>
                </div>
                <div className="purchase-total">
                  <span>Total: {totalPrice}G</span>
                </div>
                <button className="purchase-buy-button" onClick={this.purchaseItem}>BUY</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ShopPage;