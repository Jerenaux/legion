import { BaseEquipment } from "./BaseEquipment";
import { Stat, EquipmentSlot, Rarity, Class } from ".";
import { getPrice } from "./economy";

export const equipments:BaseEquipment[] = [];

equipments[0] = new BaseEquipment({
    id: 0,
    name: "Jagged Sword",
    description: "",
    frame: 0,
    effects: [{stat: Stat.ATK, value: 10}],
    slot: EquipmentSlot.WEAPON,
    effort: 15,
    minLevel: 5,
    classes: [Class.WARRIOR],
});


equipments[1] = new BaseEquipment({
    id: 1,
    name: "Basic staff",
    description: "",
    frame: 20,
    effects: [{stat: Stat.SPATK, value: 5}],
    slot: EquipmentSlot.WEAPON,
    effort: 12,
    minLevel: 1,
    classes: [Class.BLACK_MAGE, Class.WHITE_MAGE],
});


equipments[2] = new BaseEquipment({
    id: 2,
    name: "Ring of the Soul",
    description: "",
    frame: 40,
    effects: [{stat: Stat.MP, value: 200}],
    slot: EquipmentSlot.LEFT_RING,
    effort: 40,
    minLevel: 1,
    classes: [Class.BLACK_MAGE, Class.WHITE_MAGE],
});

equipments[3] = new BaseEquipment({
    id: 3,
    name: "Basic belt",
    description: "Increases item slots by 1",
    frame: 60,
    effects: [],
    slot: EquipmentSlot.BELT,
    effort: 30,
    beltSize: 1,
});

equipments[4] = new BaseEquipment({
    id: 4,
    name: "Large belt",
    description: "Increases item slots by 2",
    frame: 61,
    effects: [],
    slot: EquipmentSlot.BELT,
    effort: 70,
    beltSize: 2,
});

equipments[5] = new BaseEquipment({
    id: 5,
    name: "Dagger",
    description: "",
    frame: 1,
    effects: [{stat: Stat.ATK, value: 3}],
    slot: EquipmentSlot.WEAPON,
    effort: 3,
    minLevel: 1,
    classes: [Class.WARRIOR],
});

export function getEquipmentById(id:number):BaseEquipment {
    return equipments.find(e => e.id === id);
}