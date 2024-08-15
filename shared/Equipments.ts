import { BaseEquipment } from "./BaseEquipment";
import { Stat, EquipmentSlot, Rarity, Class } from ".";
import { getPrice } from "./economy";

export const equipments:BaseEquipment[] = [];

equipments[0] = new BaseEquipment({
    id: 0,
    name: "Jagged Sword",
    description: "",
    frame: 0,
    effects: [{stat: Stat.ATK, value: 15}],
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
    effort: 9,
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
    minLevel: 10,
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
    minLevel: 20,
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

equipments[6] = new BaseEquipment({
    id: 6,
    name: "Traveler's hat",
    description: "",
    frame: 70,
    effects: [{stat: Stat.DEF, value: 2}],
    slot: EquipmentSlot.HELMET,
    effort: 3,
    minLevel: 1,
});

equipments[7] = new BaseEquipment({
    id: 7,
    name: "Cloth tunic",
    description: "",
    frame: 90,
    effects: [{stat: Stat.DEF, value: 4}],
    slot: EquipmentSlot.ARMOR,
    effort: 4,
    minLevel: 1,
});

equipments[8] = new BaseEquipment({
    id: 8,
    name: "Hardened gloves",
    description: "",
    frame: 110,
    effects: [{stat: Stat.DEF, value: 10}],
    slot: EquipmentSlot.GLOVES,
    effort: 10,
    minLevel: 5,
});

equipments[9] = new BaseEquipment({
    id: 9,
    name: "Light boots",
    description: "",
    frame: 130,
    effects: [{stat: Stat.DEF, value: 3}],
    slot: EquipmentSlot.BOOTS,
    effort: 3,
    minLevel: 1,
});

equipments[10] = new BaseEquipment({
    id: 10,
    name: "Golden necklace",
    description: "",
    frame: 50,
    effects: [{stat: Stat.HP, value: 20}],
    slot: EquipmentSlot.NECKLACE,
    effort: 4,
    minLevel: 1,
});

equipments[11] = new BaseEquipment({
    id: 11,
    name: "Helmet",
    description: "",
    frame: 71,
    effects: [{stat: Stat.DEF, value: 15}],
    slot: EquipmentSlot.HELMET,
    effort: 11,
    minLevel: 5,
    classes: [Class.WARRIOR],
});

equipments[12] = new BaseEquipment({
    id: 12,
    name: "Leather armor",
    description: "",
    frame: 91,
    effects: [{stat: Stat.DEF, value: 16}],
    slot: EquipmentSlot.ARMOR,
    effort: 12,
    minLevel: 5,
    classes: [Class.WARRIOR],
});

equipments[13] = new BaseEquipment({
    id: 13,
    name: "Armored gloves",
    description: "",
    frame: 111,
    effects: [{stat: Stat.DEF, value: 18}],
    slot: EquipmentSlot.GLOVES,
    effort: 16,
    minLevel: 10,
    classes: [Class.WARRIOR],
});

equipments[14] = new BaseEquipment({
    id: 14,
    name: "Armored boots",
    description: "",
    frame: 131,
    effects: [{stat: Stat.DEF, value: 11}],
    slot: EquipmentSlot.BOOTS,
    effort: 10,
    minLevel: 5,
    classes: [Class.WARRIOR],
});

equipments[15] = new BaseEquipment({
    id: 15,
    name: "Light gloves",
    description: "",
    frame: 112,
    effects: [{stat: Stat.DEF, value: 3}],
    slot: EquipmentSlot.GLOVES,
    effort: 3,
    minLevel: 1,
});

equipments[16] = new BaseEquipment({
    id: 16,
    name: "Jade necklace",
    description: "",
    frame: 51,
    effects: [{stat: Stat.MP, value: 20}],
    slot: EquipmentSlot.NECKLACE,
    effort: 6,
    minLevel: 1,
    classes: [Class.BLACK_MAGE, Class.WHITE_MAGE],
});

equipments[17] = new BaseEquipment({
    id: 17,
    name: "Golden ring",
    description: "",
    frame: 41,
    effects: [{stat: Stat.HP, value: 20}],
    slot: EquipmentSlot.LEFT_RING,
    effort: 4,
    minLevel: 1,
});

export function getEquipmentById(id:number): BaseEquipment | undefined {
    return equipments.find(e => e.id === id);
}

export function getRandomEquipmentByRarity(rarity: number): BaseEquipment {
    const filtered = equipments.filter(item => item.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
}