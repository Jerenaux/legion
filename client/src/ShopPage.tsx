// ShopPage.tsx
import { h, Component } from 'preact';

class ShopPage extends Component {
  state = {
    items: [
      { id: 1, name: 'Potion', image: 'assets/items/potion.png', price: 100 },
      { id: 2, name: 'Clover', image: 'assets/items/clover.png', price: 200 },
      // Add more items as needed
    ],
  };

  render() {
    return (
      <div>
        <div className="page-header">
          <img src="assets/shop.png" className="page-icon" />
          <h1 className="page-title">Shop</h1>
        </div>
        <div className="shop-content">
            <div className="gold-container">
                <img src="assets/gold2.png" className="gold-icon" /> {/* Replace with your gold icon */}
                <span>2000</span>
            </div>

            <div className="shop-grid">
              {this.state.items.map((item) => (
                <div key={item.id} className="shop-item-card">
                  <div className="shop-item-card-header">
                    <div className="shop-item-card-name">{item.name}</div>
                    <div className="shop-item-card-name-shadow">{item.name}</div>
                  </div>
                  <div className="shop-item-card-content">
                    <div style={{ backgroundImage: `url(${item.image})` }} className="shop-item-image"></div>
                    <div className="shop-item-card-price">{item.price}</div>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>
    );
  }
}

export default ShopPage;