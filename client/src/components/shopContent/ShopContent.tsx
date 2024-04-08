// ShopContent.tsx
import { PlayerInventory } from '@legion/shared/interfaces';
import { ShopTabIcons, ShopTabs } from './ShopContent.data';
import './ShopContent.style.css';
import { h, Component } from 'preact';

interface ShopContentProps {
    inventoryData: PlayerInventory;
    characters: any;
}

class ShopContent extends Component<ShopContentProps> {
    state = {
        curr_tab: ShopTabs.CONSUMABLES
    }
    render() {
        const tabItemStyle = (index: number) => {
            return {
                backgroundImage: `url(/shop/tabs_${index === this.state.curr_tab ? 'active' : 'idle'}.png)`,
            }
        }

        return (
            <div className='shop-content'>
                <div className='shop-tabs-container'>
                    {Object.keys(ShopTabIcons).map(key => ShopTabIcons[key]).map((icon, index) =>
                        <div
                            key={index}
                            className='shop-tab-item'
                            style={tabItemStyle(index)}
                            onClick={() => this.setState({ curr_tab: index })}>
                            <img src={`/shop/${icon}`} alt="icon" />
                        </div>
                    )}
                </div>
                <div className='shop-items-container'>Items container</div>
            </div>
        );
    }
}

export default ShopContent;