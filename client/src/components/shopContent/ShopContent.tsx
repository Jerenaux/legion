// ShopContent.tsx
import './ShopContent.style.css';
import { h, Component } from 'preact';
import { PlayerInventory } from '@legion/shared/interfaces';
import { ShopTabIcons, ShopTabs } from './ShopContent.data';
import ShopSpellCard from '../shopSpellCard/ShopSpellCard';
import ShopConsumableCard from '../shopConsumableCard/ShopConsumableCard';
import ShopEquipmentCard from '../shopEquipmentCard/ShopEquipmentCard';
import ShopCharacterCard from '../shopCharacterCard/shopCharacterCard';

interface ShopContentProps {
    inventoryData: PlayerInventory;
    characters: CharacterData[];
}

class ShopContent extends Component<ShopContentProps> {
    state = {
        curr_tab: ShopTabs.CHARACTERS
    }
    render() {
        const {inventoryData, characters} = this.props;

        const tabItemStyle = (index: number) => {
            return {
                backgroundImage: `url(/shop/tabs_${index === this.state.curr_tab ? 'active' : 'idle'}.png)`,
            }
        }

        const renderItems = () => {
            switch(this.state.curr_tab) {
                case ShopTabs.SPELLS:
                    return inventoryData.spells.map((item, index) => <ShopSpellCard key={index} index={item} />)
                case ShopTabs.CONSUMABLES:
                    return inventoryData.consumables.map((item, index) => <ShopConsumableCard key={index} index={item} />)
                case ShopTabs.EQUIPMENTS:
                    return inventoryData.equipment.map((item, index) => <ShopEquipmentCard key={index} index={item} />)
                case ShopTabs.CHARACTERS:
                    return characters.map((item, index) => <ShopCharacterCard key={index} data={item} />)
                default:
                    return null;
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
                <div className='shop-items-container'>{renderItems()}</div>
            </div>
        );
    }
}

export default ShopContent;