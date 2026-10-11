import {onRequest} from './telemetry';
import {firestore} from './APIsetup';
import {INVITE_ORIGIN, giftId, giftTokenPattern, validateGiftRewards} from './gifts';
import {communitySummary, normalizeCommunityCode} from '@legion/shared/communities';
import {INVITE_CSP, InvitePageInput, renderInvitePage} from './invitePage';
import type {ChestReward} from '@legion/shared/interfaces';
import {pickInviteLanguage} from './inviteCopy';

const PAGE_HEADERS = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': INVITE_CSP};

/** The page data plus the language stored on the gift or its community (operator-set). */
async function loadInvite(query: Record<string, unknown>): Promise<InvitePageInput & {storedLanguage?: unknown}> {
  const db = firestore();
  if (typeof query.gift === 'string') {
    if (!giftTokenPattern.test(query.gift)) return {invalid: true};
    const gift = (await db.collection('creatorGifts').doc(giftId(query.gift)).get()).data();
    if (!gift) return {invalid: true};
    const expired = gift.expiresAt != null && (!Number.isSafeInteger(gift.expiresAt) || gift.expiresAt <= Date.now());
    let rewards: ChestReward[] = [];
    try { rewards = validateGiftRewards(gift.rewards); } catch { /* Shown as unavailable. */ }
    const communityId = typeof gift.communityId === 'string' && gift.communityId ? gift.communityId : null;
    const communityDoc = communityId ? (await db.collection('communities').doc(communityId).get()).data() : undefined;
    return {
      gift: {token: query.gift, rewards, unlimited: gift.usage === 'unlimited', expiresAt: gift.expiresAt ?? null,
        available: rewards.length > 0 && !gift.revokedAt && !expired && !gift.claimedBy},
      community: communityDoc?.status === 'active' ? communitySummary({...communityDoc, id: communityId}) : null,
      storedLanguage: gift.language ?? communityDoc?.language,
    };
  }
  const id = normalizeCommunityCode(query.community);
  if (!id) return {invalid: true};
  const community = (await db.collection('communities').doc(id).get()).data();
  const summary = community?.status === 'active' ? communitySummary({...community, id}) : null;
  return summary ? {community: summary, storedLanguage: community?.language} : {invalid: true};
}

// GET only renders a page: link scanners and previews can never claim a gift or join.
export const invite = onRequest({invoker: 'public', memory: '256MiB'}, async (request, response) => {
  response.set(PAGE_HEADERS);
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.status(405).send('Method not allowed'); return; }
  try {
    const {storedLanguage, ...input} = await loadInvite(request.query);
    const language = pickInviteLanguage(request.query.lang, storedLanguage, request.get('accept-language'));
    response.set({'Content-Language': language, 'Vary': 'Accept-Language'});
    response.status(input.invalid ? 404 : 200).type('html').send(renderInvitePage({...input, language}));
  } catch {
    // Never log the bearer gift token or query string.
    console.error('Invite page failed');
    const language = pickInviteLanguage(request.query.lang, undefined, request.get('accept-language'));
    response.status(500).type('html').send(renderInvitePage({invalid: true, language}));
  }
});

/** Former share URLs keep working by forwarding to the invite page. */
export function redirectToInvite(param: 'gift' | 'community', value: unknown) {
  const valid = param === 'gift' ? typeof value === 'string' && giftTokenPattern.test(value) : normalizeCommunityCode(value) !== null;
  return valid ? `${INVITE_ORIGIN}/invite?${param}=${encodeURIComponent(param === 'gift' ? value as string : normalizeCommunityCode(value)!)}` : null;
}
