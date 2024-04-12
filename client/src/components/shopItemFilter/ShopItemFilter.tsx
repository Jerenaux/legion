// ShopItemFilter.tsx
import { Class, EquipmentSlot } from '@legion/shared/enums';
import './ShopItemFilter.style.css'
import { h, Component } from 'preact';
import { PlayerInventory } from '@legion/shared/interfaces';
import { equipments } from '@legion/shared/Equipments';
import { spells } from '@legion/shared/Spells';
import { ShopTabs } from '../shopContent/ShopContent.data';

interface ShopItemFilterProps {
    curr_tab: ShopTabs;
    inventoryData: PlayerInventory;
    handleInventory: (inventory: PlayerInventory) => void;
}

interface ShopItemFilterState {
    isOpen: boolean;
    currClass: number | null;
    slotCheckbox: boolean[];
}

class ShopItemFilter extends Component<ShopItemFilterProps, ShopItemFilterState> {
    state: ShopItemFilterState = {
        isOpen: false,
        currClass: null,
        slotCheckbox: new Array(9).fill(false)
    }
    render() {
        const { curr_tab, inventoryData } = this.props;

        if (curr_tab !== 1 && curr_tab !== 2) return; // only accept equipment & spells

        const CharacterClasses = Object.values(Class).filter(value => typeof value === 'string');
        const EquipmentSlots = Object.values(EquipmentSlot).filter(value => typeof value === 'string');

        const handleCurrentClass = (curr_class: string | Class) => {
            this.setState({ currClass: Class[curr_class] });

            if (Class[curr_class] === 4) {
                this.props.handleInventory(inventoryData);
                return;
            }

            const updatedInventory = curr_tab == 1 ? {
                consumables: inventoryData.consumables,
                spells: inventoryData.spells,
                equipment: inventoryData.equipment.filter(index => equipments[index].classes.includes(Class[curr_class]))
            } : {
                consumables: inventoryData.consumables,
                spells: inventoryData.spells.filter(index => spells[index].classes.includes(Class[curr_class])),
                equipment: inventoryData.equipment
            }

            this.props.handleInventory(updatedInventory);
        }

        const handleCheckboxChange = (index: number) => {
            if (curr_tab !== 1) return; // only display for equipment

            const updatedCheckboxes = [...this.state.slotCheckbox];
            updatedCheckboxes[index] = !updatedCheckboxes[index];
            this.setState({ slotCheckbox: updatedCheckboxes });

            const equipmentTemp = inventoryData.equipment;
            const updatedEquipment = equipmentTemp.filter(index => !!updatedCheckboxes[equipments[index].slot]);

            this.props.handleInventory({
                consumables: inventoryData.consumables,
                spells: inventoryData.spells,
                equipment: updatedEquipment
            });
        }

        return (
            <div>
                <div className="shop-item-filter-container" onClick={() => this.setState(prevState => ({ isOpen: !prevState.isOpen }))}>
                    <div className="shop-item-filter-title">
                        <span>Filter Items</span>
                    </div>
                </div>
                {this.state.isOpen && <div className="shop-filter-list">
                    {curr_tab === 1 && <div className="shop-filter-slots-container">
                        <div className="shop-filter-slots">
                            {EquipmentSlots.map((slot, index) => <div key={index} className="shop-filter-slot">
                                <input
                                    type="checkbox"
                                    name={slot as string}
                                    id={`${index}`}
                                    checked={this.state.slotCheckbox[index]}
                                    onChange={() => handleCheckboxChange(index)} />
                                <img src={`/inventory/${slot}_icon.png`} alt="" />
                            </div>)}
                        </div>
                        <div className="shop-filter-divider"></div>
                    </div>}

                    <ul>
                        {CharacterClasses.map(character_class => <li onClick={() => handleCurrentClass(character_class)}>
                            {this.state.currClass === Class[character_class] && <img src="/inventory/confirm_icon.png" alt="confirm" />}
                            <span>{character_class}</span>
                        </li>)}
                    </ul>
                </div>}
            </div>
        );
    }
}

export default ShopItemFilter;