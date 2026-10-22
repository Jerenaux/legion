import {BALANCE_VERSION, baseStats, spBonus, spBudget} from './combatBalance';
import {Stat, statFieldsByIndex} from './enums';
import type {DBCharacterData, CharacterStringStats} from './interfaces';
import {applyEquipmentBonuses} from './inventory';

export function emptyAllocations(): CharacterStringStats {
    return {hp: 0, mp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0};
}

/** Preserve identity/progression/items; keep the old build for support/rollback, refund once. */
export function balanceCharacter<T extends DBCharacterData>(source: T): T {
    const data = {...source};
    const budget = spBudget(data.level);
    if (data.balanceVersion !== BALANCE_VERSION) {
        data.legacyBalance = {stats: {...data.stats}, sp_bonuses: {...data.sp_bonuses},
            sp: data.sp ?? 0, allTimeSP: data.allTimeSP ?? 0};
        data.sp_allocations = emptyAllocations();
        data.balanceVersion = BALANCE_VERSION;
    }
    data.sp_allocations = {...data.sp_allocations};
    data.sp_bonuses = emptyAllocations();
    let remaining = budget;
    statFieldsByIndex.forEach((field, index) => {
        const requested = data.sp_allocations![field];
        const points = Number.isSafeInteger(requested) ? Math.max(0, Math.min(requested, remaining)) : 0;
        data.sp_allocations![field] = points;
        data.sp_bonuses[field] = spBonus(index as Stat, points);
        remaining -= points;
    });
    data.sp = remaining;
    data.allTimeSP = budget;
    data.stats = baseStats(data.class, data.level);
    data.equipment_bonuses = applyEquipmentBonuses(data.equipment);
    return data;
}
