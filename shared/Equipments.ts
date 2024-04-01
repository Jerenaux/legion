import { BaseEquipment } from "./BaseEquipment";
import { Stat, EquipmentSlot, Rarity } from ".";

export const equipments:BaseEquipment[] = [];

equipments[0] = new BaseEquipment({
    id: 0,
    name: "Jagged Sword",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    frame: "sword_001.png",
    effects: [{stat: Stat.ATK, value: 5}],
    slot: EquipmentSlot.WEAPON,
    price: 100,
    rarity: Rarity.COMMON,
});


equipments[1] = new BaseEquipment({
    id: 1,
    name: "Basic staff",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    frame: "staff_001.png",
    effects: [{stat: Stat.SPATK, value: 5}],
    slot: EquipmentSlot.WEAPON,
    price: 120,
    rarity: Rarity.COMMON,
});


equipments[2] = new BaseEquipment({
    id: 2,
    name: "Ring of defense",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    frame: "ring_001.png",
    effects: [{stat: Stat.DEF, value: 3}],
    slot: EquipmentSlot.LEFT_RING,
    price: 30,
    rarity: Rarity.RARE,
});