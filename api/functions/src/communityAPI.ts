import {onRequest} from './telemetry';
import {corsMiddleware, getUID, firestore} from './APIsetup';
import {currentSeasonId} from './ranking';
import {secondsUntilNextSeason} from './leaderboardsAPI';
import {CommunityError, communityDetails, communityRanking, joinCommunity as joinCommunityRecord} from './communityStore';
import {normalizeCommunityCode} from '@legion/shared/communities';
import {STEAM_DEMO_APP_ID} from './platformIdentity';

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

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

// Creators share this HTTPS page: it works in any app, explains the code, and launches Legion.
export const communityLink = onRequest({invoker: 'public'}, (request, response) => {
  const code = normalizeCommunityCode(request.query.code);
  response.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
  if (request.method !== 'GET' || !code) { response.status(400).send('Invalid community link'); return; }
  const display = escapeHTML(code.toUpperCase());
  response.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Join a Legion community</title>
<style>body{font:18px/1.6 system-ui,sans-serif;background:#151d27;color:#eef2f5;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:32rem;padding:2rem}h1{line-height:1.2}a{color:#eec858}a.join{display:inline-block;padding:.8rem 1.2rem;background:#eec858;color:#151d27;border-radius:.4rem;font-weight:700;text-decoration:none}code{font-size:1.3em;color:#eec858}a:focus-visible{outline:3px solid white;outline-offset:4px}</style>
<main><h1>Join the ${display} community in Legion</h1><p>Your profile, matches and leaderboards will show the community's sigil. You can belong to one community.</p>
<p><a href="https://store.steampowered.com/app/${STEAM_DEMO_APP_ID}/">1. Install the free demo on Steam</a></p>
<p><a class="join" href="steam://run/${STEAM_DEMO_APP_ID}/?community=${code}">2. Launch Legion and join</a></p>
<p>Or enter the code <code>${display}</code> in your profile under Join a community.</p></main></html>`);
});
