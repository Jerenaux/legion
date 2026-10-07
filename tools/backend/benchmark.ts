// Run against the isolated emulator suite only; never use production credentials/endpoints.
import {strict as assert} from 'node:assert';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(new URL('../../api/functions/package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18090';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {NewCharacter} = await import('../../shared/NewCharacter');
const {FIRESTORE_DATABASE_ID} = await import('../../shared/config');
const {Class} = await import('../../shared/enums');
initializeApp({projectId: 'legion-32c6d'});
const db = getFirestore(FIRESTORE_DATABASE_ID);
const base = 'http://127.0.0.1:15001/legion-32c6d/us-central1';
const phase = process.argv[2] || 'optimized';
async function request(endpoint: string, body?: unknown, token?: string) {
  const response = await fetch(`${base}/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {'Content-Type': 'application/json', 'x-api-key': 'local-backend-test', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  assert(response.ok, `${endpoint}: ${response.status} ${await response.clone().text()}`);
  return response.json();
}
const session = await request('createPlatformSession', {provider: 'direct', credential: 'backend-benchmark-device-0001'});
const auth = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local', {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: session.customToken, returnSecureToken: true}),
}).then(r => r.json());
assert(auth.idToken, 'emulator sign-in');
const template = (await db.collection('players').doc(session.uid).get()).data()!;
const refs = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].map((kind, i) => {
  const ref = db.collection('characters').doc(`benchmark-character-${i}`);
  return {ref, data: new NewCharacter(kind, 1, false).getCharacterData()};
});
await Promise.all(refs.map(({ref, data}) => ref.set(data)));
for (let start = 0; start < 1500; start += 250) {
  const batch = db.batch();
  for (let i = start; i < start + 250; i++) batch.set(db.collection('players').doc(`benchmark-opponent-${i}`), {
    ...template, name: `Opponent ${i}`, elo: i - 500, league: i % 3,
    lastActiveDate: '2020-01-01 00:00:00', characters: refs.map(r => r.ref),
    inventory: {consumables: Array(40).fill(0), equipment: Array(40).fill(0), spells: Array(40).fill(0)},
  });
  await batch.commit();
}
const results: Record<string, unknown> = {};
async function bench(name: string, fn: () => Promise<unknown>) {
  const first = performance.now(); await fn(); const firstMs = performance.now() - first;
  const times = [];
  for (let i=0; i<10; i++) {const start = performance.now(); await fn(); times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);
  results[name] = {firstMs: Math.round(firstMs), medianMs: Math.round((times[4]+times[5])/2), p90Ms: Math.round(times[8])};
}
await bench('sessionExisting', () => request('createPlatformSession', {provider: 'direct', credential: 'backend-benchmark-device-0001'}));
await bench('player', () => request('getPlayerData', undefined, auth.idToken));
await bench('roster', () => request('rosterData', undefined, auth.idToken));
await bench('startup', () => phase === 'baseline'
  ? Promise.all([request('getPlayerData', undefined, auth.idToken), request('rosterData', undefined, auth.idToken)])
  : request('bootstrapPlayer', undefined, auth.idToken));
await bench('createGameHTTP', () => request('createGame', {gameId: `benchmark-${crypto.randomUUID()}`, players: [session.uid], mode: 0, league: 0}));
await bench('zombieCasual', () => request('zombieData?league=-1&elo=100'));
await bench('zombieRanked', () => request('zombieData?league=0&elo=100'));
if (phase !== 'baseline') {
  const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
  const {io} = clientRequire('socket.io-client');
  const socket = io('http://127.0.0.1:13000', {auth:{token:auth.idToken}, autoConnect:false, reconnection:false});
  try {
    await new Promise<void>((resolve,reject) => {socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
    await bench('createMatchSocket', () => new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Match creation timed out')),5000);
      socket.once('matchFound', ({gameId}: {gameId:string}) => {clearTimeout(timer);socket.emit('leaveGame',{gameId});resolve(gameId);});
      socket.emit('joinQueue',{mode:0});
    }));
  } finally {socket.disconnect();}
}
writeFileSync(join(tmpdir(), `legion-backend-${phase}.json`), JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await db.terminate();
