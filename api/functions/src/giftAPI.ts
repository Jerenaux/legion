import {onRequest} from './telemetry';
import admin, {corsMiddleware, getUID} from './APIsetup';
import {giftTokenPattern, redeemGiftToken} from './gifts';
import {STEAM_DEMO_APP_ID} from './platformIdentity';

export const redeemGift = onRequest({memory: '512MiB', invoker: 'public'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    let uid: string;
    try { uid = await getUID(request); } catch { response.status(401).send('Unauthorized'); return; }
    try {
      response.set('Cache-Control', 'no-store').json(await redeemGiftToken(admin.firestore(), uid, request.body?.token));
    } catch {
      // Never log the bearer gift token or request body.
      console.error('Gift redemption failed');
      response.status(500).send('Unable to claim gift');
    }
  });
});

// A normal HTTPS email link works even when the mail client strips steam:// URLs.
// GET only displays a button: email scanners cannot consume a gift.
export const giftLink = onRequest({invoker: 'public'}, (request, response) => {
  const token = request.query.token;
  response.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
  if (request.method !== 'GET' || typeof token !== 'string' || !giftTokenPattern.test(token)) {
    response.status(400).send('Invalid gift link'); return;
  }
  response.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Legion gift</title>
<style>body{font:18px/1.6 system-ui,sans-serif;background:#151d27;color:#eef2f5;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:32rem;padding:2rem}h1{line-height:1.2}a{color:#eec858}a.claim{display:inline-block;padding:.8rem 1.2rem;background:#eec858;color:#151d27;border-radius:.4rem;font-weight:700;text-decoration:none}a:focus-visible{outline:3px solid white;outline-offset:4px}</style>
<main><h1>Your Legion gift awaits</h1><p>Install the free demo, then return here to launch Legion and claim your gear. Your gift goes to the account playing the game.</p>
<p><a href="https://store.steampowered.com/app/${STEAM_DEMO_APP_ID}/">1. Install the demo on Steam</a></p>
<p><a class="claim" href="steam://run/${STEAM_DEMO_APP_ID}//?gift=${token}">2. Launch Legion and claim</a></p>
<p>Already claimed? Your gear stays in your shared inventory. Clicking again won't grant it twice.</p></main></html>`);
});
