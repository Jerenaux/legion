// ShopItemFilter.tsx
import { Class, ClassLabels, EquipmentSlot, ShopTabs } from '@legion/shared/enums';
import './ShopItemFilter.style.css'
import { h, Component } from 'preact';
import { ShopItems } from '@legion/shared/interfaces';

// Import image assets
import confirmIcon from '@assets/inventory/confirm_icon.png';

// Import equipment slot icons
import weaponIcon from '@assets/inventory/weapon_icon.png';
import helmetIcon from '@assets/inventory/helmet_icon.png';
import armorIcon from '@assets/inventory/armor_icon.png';
import beltIcon from '@assets/inventory/belt_icon.png';
import glovesIcon from '@assets/inventory/gloves_icon.png';
import bootsIcon from '@assets/inventory/boots_icon.png';
import leftRingIcon from '@assets/inventory/left_ring_icon.png';
import rightRingIcon from '@assets/inventory/right_ring_icon.png';
import necklaceIcon from '@assets/inventory/necklace_icon.png';

const equipmentSlotIcons = {
    [EquipmentSlot.WEAPON]: weaponIcon,
    [EquipmentSlot.HELMET]: helmetIcon,
    [EquipmentSlot.ARMOR]: armorIcon,
    [EquipmentSlot.BELT]: beltIcon,
    [EquipmentSlot.GLOVES]: glovesIcon,
    [EquipmentSlot.BOOTS]: bootsIcon,
    [EquipmentSlot.LEFT_RING]: leftRingIcon,
    [EquipmentSlot.RIGHT_RING]: rightRingIcon,
    [EquipmentSlot.NECKLACE]: necklaceIcon,
};

interface ShopItemFilterProps {
    curr_tab: ShopTabs;
    shopItems: ShopItems;
    handleInventory: (inventory: ShopItems) => void;
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
        const { curr_tab, shopItems } = this.props;

        if (curr_tab !== 1 && curr_tab !== 2) return null; // only accept equipment & spells

        const CharacterClasses = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
        const EquipmentSlots = Object.values(EquipmentSlot).filter(value => typeof value === 'string');

        const handleCurrentClass = (curr_class: string | Class) => {
            this.setState({ currClass: Class[curr_class] });

            if (Class[curr_class] === 4) {
                this.props.handleInventory(shopItems);
                return;
            }

            const updatedInventory = curr_tab == 1 ? {
                consumables: shopItems.consumables,
                spells: shopItems.spells,
                equipment: shopItems.equipment.filter(item => item.classes.includes(Class[curr_class]))
            } : {
                consumables: shopItems.consumables,
                spells: shopItems.spells.filter(item => item.classes.includes(Class[curr_class])),
                equipment: shopItems.equipment
            }

            this.props.handleInventory(updatedInventory);
        }

        const handleCheckboxChange = (index: number) => {
            if (curr_tab !== 1) return; // only display for equipment

            const updatedCheckboxes = [...this.state.slotCheckbox];
            updatedCheckboxes[index] = !updatedCheckboxes[index];
            this.setState({ slotCheckbox: updatedCheckboxes });

            const equipmentTemp = shopItems.equipment;
            const updatedEquipment = equipmentTemp.filter(item => updatedCheckboxes[item.slot]);

            const noChecked = updatedEquipment.length == 0 && updatedCheckboxes.filter(item => item).length == 0;

            this.props.handleInventory({
                consumables: shopItems.consumables,
                spells: shopItems.spells,
                equipment: noChecked ? shopItems.equipment : updatedEquipment
            });
        }

        return (
            <div>
                <div className="shop-item-filter-container" onClick={() => this.setState(prevState => ({ isOpen: !prevState.isOpen }))}>
                    <div className="shop-item-filter-title">
                        <span>Filter Items</span>
                    </div>
                </div>
                {this.state.isOpen && (
                    <div className="shop-filter-list">
                        {curr_tab === 1 && (
                            <div className="shop-filter-slots-container">
                                <div className="shop-filter-slots">
                                    {EquipmentSlots.map((slot, index) => (
                                        <div key={index} className="shop-filter-slot">
                                            <input
                                                type="checkbox"
                                                name={slot as string}
                                                id={`${index}`}
                                                checked={this.state.slotCheckbox[index]}
                                                onChange={() => handleCheckboxChange(index)}
                                            />
                                            <img src={equipmentSlotIcons[EquipmentSlot[slot]]} alt={slot as string} />
                                        </div>
                                    ))}
                                </div>
                                <div className="shop-filter-divider"></div>
                            </div>
                        )}

                        <ul>
                            {CharacterClasses.map(character_class => (
                                <li key={character_class} onClick={() => handleCurrentClass(character_class)}>
                                    {this.state.currClass === character_class && <img src={confirmIcon} alt="confirm" />}
                                    <span>{ClassLabels[character_class]}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }
}

export default ShopItemFilter;