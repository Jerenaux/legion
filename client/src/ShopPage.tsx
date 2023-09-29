// ShopPage.tsx
import { h, Component } from 'preact';
import Description from './Description';

interface State {
  items: Array<any>;
  isDialogOpen: boolean;
  selectedItem: any;
  quantity: number;
}

class ShopPage extends Component<{}, State> {
  state: State = {
    items: [
      { id: 1, name: 'Potion', description: 'Restores 50 HP', image: 'assets/items/potion.png', price: 100, target: "self", cooldown: 2, effects: [{ stat: "hp", value: 50 }] },
      { id: 2, name: 'Clover', description: 'Resurrects a character', image: 'assets/items/clover.png', price: 200, target: "self", cooldown: 2, effects: [{ stat: "mp", value: 50 }] },
      // Add more items as needed
    ],
    isDialogOpen: false,
    selectedItem: null,
    quantity: 1,
  };

  openDialog = (item) => {
    this.setState({ isDialogOpen: true, selectedItem: item, quantity: 1 });
  }

  closeDialog = () => {
    this.setState({ isDialogOpen: false, selectedItem: null });
  }

  changeQuantity = (amount) => {
    this.setState((prevState) => ({ quantity: prevState.quantity + amount }));
  }

  purchaseItem = () => {
    // handle the purchase here
    this.closeDialog();
  }

  render() {
    const { isDialogOpen, selectedItem, quantity } = this.state;

    return (
      <div>
        <div className="page-header">
          <img src="assets/shop.png" className="page-icon" />
          <h1 className="page-title">Shop</h1>
        </div>
        <div className="shop-content">
            <div className="gold-container" title='Your gold'>
                <img src="assets/gold2.png" className="gold-icon" /> {/* Replace with your gold icon */}
                <span>2000</span>
            </div>

            <div className="shop-grid">
              {this.state.items.map((item) => (
                <div key={item.id} className="shop-item-card" onClick={() => this.openDialog(item)}>
                  <div className="shop-item-card-header">
                    <div className="shop-item-card-name">{item.name}</div>
                    <div className="shop-item-card-name-shadow">{item.name}</div>
                  </div>
                  <div className="shop-item-card-content">
                    <div style={{ backgroundImage: `url(${item.image})` }} className="shop-item-image"></div>
                    <div className="shop-item-details">
                      {item.description}
                      <Description action={item} />
                    </div>
                    <div className="shop-item-card-price" title='Price'>{item.price}</div>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {isDialogOpen && (
          <div className="dialog">
            <button className="close-button" onClick={this.closeDialog}>X</button>
            <h2>
              Purchasing 
              <button onClick={() => this.changeQuantity(-1)}>-</button>
              <input type="text" value={quantity} readOnly />
              <button onClick={() => this.changeQuantity(1)}>+</button>
              {selectedItem.name}
            </h2>
            <div>Total: {quantity * selectedItem.price}</div>
            <button onClick={this.purchaseItem}>Purchase</button>
          </div>
        )}
      </div>
    );
  }
}

export default ShopPage;