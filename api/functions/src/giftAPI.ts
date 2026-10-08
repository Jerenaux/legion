import {onRequest} from './telemetry';
import {redirectToInvite} from './inviteAPI';
import {corsMiddleware, getUID, firestore} from './APIsetup';
import {redeemGiftToken} from './gifts';

export const redeemGift = onRequest({memory: '512MiB', invoker: 'public'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    let uid: string;
    try { uid = await getUID(request); } catch { response.status(401).send('Unauthorized'); return; }
    try {
      response.set('Cache-Control', 'no-store').json(await redeemGiftToken(firestore(), uid, request.body?.token));
    } catch {
      // Never log the bearer gift token or request body.
      console.error('Gift redemption failed');
      response.status(500).send('Unable to claim gift');
    }
  });
});

// Former gift share URL: forwards to the combined invite page on play-legion.io.
export const giftLink = onRequest({invoker: 'public'}, (request, response) => {
  response.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'});
  const target = redirectToInvite('gift', request.query.token);
  if (request.method !== 'GET' || !target) { response.status(400).send('Invalid gift link'); return; }
  response.redirect(302, target);
});
