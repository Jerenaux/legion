import { BaseEquipment } from "./BaseEquipment";
import { Stat, EquipmentSlot, Rarity, Class } from ".";
import { getPrice } from "./economy";

export const equipments:BaseEquipment[] = [];

equipments[0] = new BaseEquipment({
    id: 0,
    name: "Jagged Sword",
    description: "Increases ATK by 5",
    frame: 0,
    effects: [{stat: Stat.ATK, value: 5}],
    slot: EquipmentSlot.WEAPON,
    price: getPrice(10),
    rarity: Rarity.COMMON,
    minLevel: 1,
    classes: [Class.WARRIOR],
});


equipments[1] = new BaseEquipment({
    id: 1,
    name: "Basic staff",
    description: "Increases SPATK by 5",
    frame: 20,
    effects: [{stat: Stat.SPATK, value: 5}],
    slot: EquipmentSlot.WEAPON,
    price: getPrice(12),
    rarity: Rarity.COMMON,
    minLevel: 1,
    classes: [Class.BLACK_MAGE, Class.WHITE_MAGE],
});


equipments[2] = new BaseEquipment({
    id: 2,
    name: "Ring of defense",
    description: "Increases DEF by 3",
    frame: 40,
    effects: [{stat: Stat.DEF, value: 3}],
    slot: EquipmentSlot.LEFT_RING,
    price: getPrice(11),
    rarity: Rarity.COMMON,
    minLevel: 1,
    classes: [Class.WARRIOR, Class.BLACK_MAGE, Class.WHITE_MAGE],
});

equipments[3] = new BaseEquipment({
    id: 3,
    name: "Basic belt",
    description: "Increases item slots by 1",
    frame: 60,
    effects: [],
    slot: EquipmentSlot.BELT,
    price: getPrice(30),
    rarity: Rarity.RARE,
    beltSize: 1,
});

equipments[4] = new BaseEquipment({
    id: 4,
    name: "Large belt",
    description: "Increases item slots by 2",
    frame: 61,
    effects: [],
    slot: EquipmentSlot.BELT,
    price: getPrice(70),
    rarity: Rarity.EPIC,
    beltSize: 2,
});