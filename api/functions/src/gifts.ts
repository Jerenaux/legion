import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {RewardType} from '@legion/shared/enums';
import type {ChestReward, DBPlayerData} from '@legion/shared/interfaces';
import {getEquipmentById} from '@legion/shared/Equipments';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {addItemsToInventory} from './inventoryUtils';
import {type CommunitySummary, communitySummary, normalizeCommunityCode} from '@legion/shared/communities';

/** Public pages and the CLI print this domain; Hosting rewrites /invite to the `invite` Function. */
export const INVITE_ORIGIN = 'https://www.play-legion.io';

export type GiftUsage = 'single' | 'unlimited';
export const isGiftUsage = (value: unknown): value is GiftUsage => value === 'single' || value === 'unlimited';

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

/** A gift can invite its recipients to a creator community; joining stays the player's choice. */
export type GiftResult = {status: 'claimed' | 'already_claimed'; rewards: ChestReward[]; community?: CommunitySummary | null}
  | {status: 'unavailable' | 'player_not_ready'};

/** The active community a gift invites to, if any (revoked communities are ignored). */
export async function giftCommunity(db: Firestore, communityId: unknown): Promise<CommunitySummary | null> {
  if (typeof communityId !== 'string' || !communityId) return null;
  const community = (await db.collection('communities').doc(communityId).get()).data();
  return community?.status === 'active' ? communitySummary({...community, id: communityId}) : null;
}

export async function redeemGiftToken(db: Firestore, uid: string, token: unknown): Promise<GiftResult> {
  if (typeof token !== 'string' || !giftTokenPattern.test(token)) return {status: 'unavailable'};
  return redeemGiftById(db, uid, giftId(token));
}

async function redeemGiftById(db: Firestore, uid: string, id: string, code?: string): Promise<GiftResult> {
  const giftRef = db.collection('creatorGifts').doc(id);
  const playerRef = db.collection('players').doc(uid);
  let communityId: unknown;
  const result: GiftResult = await db.runTransaction(async transaction => {
    const gift = (await transaction.get(giftRef)).data();
    communityId = gift?.communityId;
    // Public codes must never claim personal gifts, even if a campaign changed after lookup.
    if (code) {
      const community = (await transaction.get(db.collection('communities').doc(code))).data();
      if (community?.status !== 'active' || gift?.usage !== 'unlimited' || gift.communityId !== code) return {status: 'unavailable'};
    }
    if (!gift || (gift.usage !== undefined && !isGiftUsage(gift.usage))) return {status: 'unavailable'};
    // Retrying a successful claim returns its receipt, even after expiry/revocation.
    if (gift.claimedBy) return gift.claimedBy === uid
      ? {status: 'already_claimed', rewards: validateGiftRewards(gift.rewards)} : {status: 'unavailable'};
    const claimRef = giftRef.collection('claims').doc(uid);
    if (gift.usage === 'unlimited') {
      const claim = (await transaction.get(claimRef)).data();
      if (claim) return {status: 'already_claimed', rewards: validateGiftRewards(claim.rewards)};
    }
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
    if (gift.usage === 'unlimited') {
      // No shared counter/write: audience members contend only on their own account/receipt.
      transaction.create(claimRef, {claimedAt: Date.now(), rewards});
    } else transaction.update(giftRef, {claimedBy: uid, claimedAt: Date.now()});
    return {status: 'claimed', rewards};
  });
  if (result.status !== 'claimed' && result.status !== 'already_claimed') return result;
  return {...result, community: await giftCommunity(db, communityId)};
}

/** Public creator codes claim audience campaigns using the same receipts as their links. */
export async function redeemCommunityCode(db: Firestore, uid: string, value: unknown): Promise<GiftResult | {status: 'no_gift'; community: CommunitySummary}> {
  const code = normalizeCommunityCode(value);
  const community = code ? await giftCommunity(db, code) : null;
  if (!community || !code) return {status: 'unavailable'};
  const gifts = await db.collection('creatorGifts').where('communityId', '==', code).where('usage', '==', 'unlimited').get();
  const results: Extract<GiftResult, {rewards: ChestReward[]}>[] = [];
  for (const gift of gifts.docs) {
    const result = await redeemGiftById(db, uid, gift.id, code);
    if (result.status === 'player_not_ready') return result;
    if (result.status === 'claimed' || result.status === 'already_claimed') results.push(result);
  }
  // A retry can finish a partially completed set without granting any campaign twice.
  const claimed = results.filter(result => result.status === 'claimed');
  const receipts = claimed.length ? claimed : results;
  if (!receipts.length) return {status: 'no_gift', community};
  const rewards: ChestReward[] = [];
  for (const receipt of receipts) for (const reward of receipt.rewards) {
    const existing = rewards.find(item => item.type === reward.type && item.id === reward.id);
    if (existing) existing.amount += reward.amount;
    else rewards.push({...reward});
  }
  return {status: claimed.length ? 'claimed' : 'already_claimed', rewards, community};
}
