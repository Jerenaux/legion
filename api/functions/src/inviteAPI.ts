import {onRequest} from './telemetry';
import {firestore} from './APIsetup';
import {INVITE_ORIGIN, giftCommunity, giftId, giftTokenPattern, validateGiftRewards} from './gifts';
import {communitySummary, normalizeCommunityCode} from '@legion/shared/communities';
import {INVITE_CSP, InvitePageInput, renderInvitePage} from './invitePage';
import type {ChestReward} from '@legion/shared/interfaces';

const PAGE_HEADERS = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': INVITE_CSP};

async function loadInvite(query: Record<string, unknown>): Promise<InvitePageInput> {
  const db = firestore();
  if (typeof query.gift === 'string') {
    if (!giftTokenPattern.test(query.gift)) return {invalid: true};
    const gift = (await db.collection('creatorGifts').doc(giftId(query.gift)).get()).data();
    if (!gift) return {invalid: true};
    const expired = gift.expiresAt != null && (!Number.isSafeInteger(gift.expiresAt) || gift.expiresAt <= Date.now());
    let rewards: ChestReward[] = [];
    try { rewards = validateGiftRewards(gift.rewards); } catch { /* Shown as unavailable. */ }
    return {
      gift: {token: query.gift, rewards, unlimited: gift.usage === 'unlimited', expiresAt: gift.expiresAt ?? null,
        available: rewards.length > 0 && !gift.revokedAt && !expired && !gift.claimedBy},
      community: await giftCommunity(db, gift.communityId),
    };
  }
  const id = normalizeCommunityCode(query.community);
  if (!id) return {invalid: true};
  const community = (await db.collection('communities').doc(id).get()).data();
  const summary = community?.status === 'active' ? communitySummary({...community, id}) : null;
  return summary ? {community: summary} : {invalid: true};
}

// GET only renders a page: link scanners and previews can never claim a gift or join.
export const invite = onRequest({invoker: 'public', memory: '256MiB'}, async (request, response) => {
  response.set(PAGE_HEADERS);
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.status(405).send('Method not allowed'); return; }
  try {
    const input = await loadInvite(request.query);
    response.status(input.invalid ? 404 : 200).type('html').send(renderInvitePage(input));
  } catch {
    // Never log the bearer gift token or query string.
    console.error('Invite page failed');
    response.status(500).type('html').send(renderInvitePage({invalid: true}));
  }
});

/** Former share URLs keep working by forwarding to the invite page. */
export function redirectToInvite(param: 'gift' | 'community', value: unknown) {
  const valid = param === 'gift' ? typeof value === 'string' && giftTokenPattern.test(value) : normalizeCommunityCode(value) !== null;
  return valid ? `${INVITE_ORIGIN}/invite?${param}=${encodeURIComponent(param === 'gift' ? value as string : normalizeCommunityCode(value)!)}` : null;
}
