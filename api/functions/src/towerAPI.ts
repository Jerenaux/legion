import {onRequest} from './telemetry';
import admin, {corsMiddleware, getUID, checkAPIKey} from './APIsetup';
import {towerAction, settleTowerBattle, TowerActionError} from './towerStore';

export const tower = onRequest({memory: '512MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    let uid: string;
    try { uid = await getUID(request); } catch { response.status(401).send('Unauthorized'); return; }
    if (!['GET', 'POST'].includes(request.method)) { response.status(405).send('Method not allowed'); return; }
    try {
      response.json(await towerAction(admin.firestore(), uid, request.method === 'GET' ? null : request.body || {}));
    } catch (error) {
      if (error instanceof TowerActionError) { response.status(409).send(error.message); return; }
      console.error('Tower state failed', error);
      response.status(500).send('Unable to save your expedition. Please retry.');
    }
  });
});

export const towerResult = onRequest({secrets: ['API_KEY'], memory: '512MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    if (!checkAPIKey(request)) { response.status(401).send('Unauthorized'); return; }
    const {gameId, result} = request.body || {};
    if (typeof gameId !== 'string' || !/^tower-[a-zA-Z0-9-]{1,80}$/.test(gameId)) { response.status(400).send('Invalid battle'); return; }
    try {
      await settleTowerBattle(admin.firestore(), gameId, result);
      response.json({saved: true});
    } catch (error) {
      console.error('Tower result failed', error);
      response.status(500).send('Unable to save tower result');
    }
  });
});
