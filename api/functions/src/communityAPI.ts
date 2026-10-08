import {onRequest} from './telemetry';
import {redirectToInvite} from './inviteAPI';
import {corsMiddleware, getUID, firestore} from './APIsetup';
import {currentSeasonId} from './ranking';
import {secondsUntilNextSeason} from './leaderboardsAPI';
import {CommunityError, communityDetails, communityRanking, joinCommunity as joinCommunityRecord} from './communityStore';
import {normalizeCommunityCode} from '@legion/shared/communities';

const STATUS: Record<CommunityError['code'], number> = {'invalid-code': 400, 'not-found': 404, 'already-member': 409, 'no-player': 404};

async function authenticated(request: Parameters<typeof getUID>[0], response: {status: (code: number) => {send: (body: string) => void}}) {
  try { return await getUID(request); } catch { response.status(401).send('Unauthorized'); return null; }
}

export const joinCommunity = onRequest({memory: '256MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    const uid = await authenticated(request, response);
    if (!uid) return;
    try {
      const via = request.body?.via === 'link' ? 'link' : 'code';
      response.set('Cache-Control', 'no-store').json(await joinCommunityRecord(firestore(), uid, request.body?.code, via));
    } catch (error) {
      if (error instanceof CommunityError) { response.status(STATUS[error.code]).json({error: error.code}); return; }
      console.error('joinCommunity failed', error);
      response.status(500).send('Unable to join community');
    }
  });
});

export const getCommunity = onRequest({memory: '256MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    if (!await authenticated(request, response)) return;
    const id = normalizeCommunityCode(request.query.id);
    if (!id) { response.status(400).send('Invalid community'); return; }
    try {
      const details = await communityDetails(firestore(), id, currentSeasonId());
      if (!details) { response.status(404).send('Community not found'); return; }
      response.json({...details, seasonEnd: secondsUntilNextSeason()});
    } catch (error) {
      console.error('getCommunity failed', error);
      response.status(500).send('Unable to load community');
    }
  });
});

export const getCommunityRanking = onRequest({memory: '256MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    const uid = await authenticated(request, response);
    if (!uid) return;
    try {
      const db = firestore();
      const player = (await db.collection('players').doc(uid).get()).data();
      const seasonId = currentSeasonId();
      const result = await communityRanking(db, seasonId, player?.community?.id);
      response.json({seasonId, seasonEnd: secondsUntilNextSeason(), ...result});
    } catch (error) {
      console.error('getCommunityRanking failed', error);
      response.status(500).send('Unable to load community ranking');
    }
  });
});

// Former community share URL: forwards to the combined invite page on play-legion.io.
export const communityLink = onRequest({invoker: 'public'}, (request, response) => {
  response.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'});
  const target = redirectToInvite('community', request.query.code);
  if (request.method !== 'GET' || !target) { response.status(400).send('Invalid community link'); return; }
  response.redirect(302, target);
});
