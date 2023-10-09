// ShopPage.tsx
import { h, Component } from 'preact';
import Description from './Description';
import { items } from '@legion/shared/Items';

interface State {
  items: Array<any>;
  isDialogOpen: boolean;
  selectedItem: any;
  quantity: number;
}

class ShopPage extends Component<{}, State> {
  state: State = {
    items,
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
                    <div className="shop-item-card-owned" title='Amount Owned'>23</div>
                    <div className="shop-item-card-price" title='Price'>{item.price}</div>
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
            <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeDialog}></i>
            <div className="quantity-container">
                  <div className="qty-button" onClick={() => this.changeQuantity(-1)}>-</div>
                  <input className="shop-qty" type="text" value={quantity} />
                  <div className="qty-button" onClick={() => this.changeQuantity(1)}>+</div>
            </div>
            {selectedItem.name}
            <div>Total: {quantity * selectedItem.price}</div>
            <div className="" onClick={this.purchaseItem}>
              Buy
            </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default ShopPage;