import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {RewardType} from '@legion/shared/enums';
import type {ChestReward, DBPlayerData} from '@legion/shared/interfaces';
import {getEquipmentById} from '@legion/shared/Equipments';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {addItemsToInventory} from './inventoryUtils';

export const giftTokenPattern = /^[a-f0-9]{64}$/;
export const giftId = (token: string) => createHash('sha256').update(token).digest('hex');

export function validateGiftRewards(value: unknown): ChestReward[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error('Expected 1–20 rewards');
  let items = 0;
  const rewards = value.map(reward => {
    if (!reward || !Number.isSafeInteger(reward.id) || !Number.isSafeInteger(reward.amount) || reward.amount < 1) throw new Error('Invalid reward');
    if (reward.type === RewardType.GOLD) {
      if (reward.id !== 0 || reward.amount > 100000) throw new Error('Invalid gold reward');
    } else {
      const item = reward.type === RewardType.EQUIPMENT ? getEquipmentById(reward.id)
        : reward.type === RewardType.CONSUMABLES ? getConsumableById(reward.id)
        : reward.type === RewardType.SPELL ? getSpellById(reward.id) : undefined;
      if (!item) throw new Error('Unknown reward item');
      items += reward.amount;
    }
    return {type: reward.type, id: reward.id, amount: reward.amount} as ChestReward;
  });
  if (items > 100) throw new Error('A gift can contain at most 100 items');
  return rewards;
}

export type GiftResult = {status: 'claimed' | 'already_claimed'; rewards: ChestReward[]}
  | {status: 'unavailable' | 'player_not_ready'};

export async function redeemGiftToken(db: Firestore, uid: string, token: unknown): Promise<GiftResult> {
  if (typeof token !== 'string' || !giftTokenPattern.test(token)) return {status: 'unavailable'};
  const giftRef = db.collection('creatorGifts').doc(giftId(token));
  const playerRef = db.collection('players').doc(uid);
  return db.runTransaction(async transaction => {
    const gift = (await transaction.get(giftRef)).data();
    if (!gift) return {status: 'unavailable'};
    // Retrying a successful claim returns its receipt, even after expiry/revocation.
    if (gift.claimedBy) return gift.claimedBy === uid
      ? {status: 'already_claimed', rewards: validateGiftRewards(gift.rewards)} : {status: 'unavailable'};
    if (gift.revokedAt || (gift.expiresAt != null && (!Number.isSafeInteger(gift.expiresAt) || gift.expiresAt <= Date.now()))) return {status: 'unavailable'};
    const rewards = validateGiftRewards(gift.rewards);
    const player = (await transaction.get(playerRef)).data() as DBPlayerData | undefined;
    if (!player) return {status: 'player_not_ready'};
    let inventory = player.inventory;
    let gold = player.gold;
    for (const reward of rewards) {
      if (reward.type === RewardType.GOLD) gold += reward.amount;
      else inventory = addItemsToInventory({...player, inventory}, reward.type, reward.id, reward.amount).inventory as typeof inventory;
    }
    // Gifts may exceed carrying capacity, like chest rewards. Never discard paid-for/personal gifts.
    transaction.update(playerRef, {inventory, gold});
    transaction.update(giftRef, {claimedBy: uid, claimedAt: Date.now()});
    return {status: 'claimed', rewards};
  });
}
