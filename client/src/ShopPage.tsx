// ShopPage.tsx
import { h, Component } from 'preact';

class ShopPage extends Component {
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
        </div>
      </div>
    );
  }
}

export default ShopPage;