import {Stat, StatusEffect} from './enums';
import type {Effect} from './interfaces';

/** Why a consumable would do nothing to its target; null when it would have an effect. */
export type ItemNoEffectReason = 'hp-full' | 'mp-full' | 'not-knocked-out' | 'no-status';

export interface ItemTargetState {
  alive: boolean;
  hp: number;
  maxHP: number;
  mp: number;
  maxMP: number;
  hasStatus(status: StatusEffect): boolean;
}

/**
 * Shared by the server (authoritative) and the client (so players get feedback before
 * spending a request). An item applies when all of its stat effects would change
 * something, or when it removes a status the target has.
 */
export function itemNoEffectReason(
  item: {effects: Effect[]; statusRemovals?: StatusEffect[]},
  target: ItemTargetState,
): ItemNoEffectReason | null {
  const removals = item.statusRemovals || [];
  if (item.effects.length === 0 && removals.length === 0) return null;
  if (removals.some(status => target.hasStatus(status))) return null;
  let reason: ItemNoEffectReason | null = null;
  for (const effect of item.effects) {
    if (effect.onKO && target.alive) reason = 'not-knocked-out';
    else if (effect.stat === Stat.HP && target.hp >= target.maxHP) reason = 'hp-full';
    else if (effect.stat === Stat.MP && target.mp >= target.maxMP) reason = 'mp-full';
    else if (effect.stat !== Stat.HP && effect.stat !== Stat.MP) reason = reason || 'no-status';
    if (reason) return reason;
  }
  return item.effects.length > 0 ? null : 'no-status';
}
