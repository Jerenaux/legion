// Real HTTP Functions + real Socket.IO services, all backed by isolated local emulators.
import {strict as assert} from 'node:assert';
import type {Socket} from '../../client/node_modules/socket.io-client';
import type {GameData, TurnState} from '../../shared/interfaces';
import {createRequire} from 'node:module';
const requireAPI = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18090';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099';
const {initializeApp} = requireAPI('firebase-admin/app');
const {getFirestore} = requireAPI('firebase-admin/firestore');
const {io} = requireClient('socket.io-client');
const {PlayMode} = await import('../../shared/enums');
initializeApp({projectId: 'legion-32c6d'});
const db = getFirestore();
const api = 'http://127.0.0.1:15001/legion-32c6d/us-central1';
const sockets: Socket[] = [];
type Events = {connect: undefined; connect_error: Error; disconnect: string; matchFound: {gameId: string}; gameStatus: GameData; turnee: TurnState};
const timings: Record<string, number> = {};
const run = crypto.randomUUID();
async function http(endpoint: string, body?: unknown, token?: string, store = false) {
  const response = await fetch(`${api}/${endpoint}`, {
    method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json', 'x-api-key':'local-backend-test', 'x-store-build':String(store), ...(token ? {Authorization:`Bearer ${token}`} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  assert(response.ok, `${endpoint}: ${response.status} ${await response.clone().text()}`);
  return response.json();
}
async function login(device: string) {
  const session = await http('createPlatformSession', {provider:'direct', credential:device});
  const auth = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=local', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:session.customToken,returnSecureToken:true}),
  }).then(r=>r.json());
  assert(auth.idToken); return {uid:session.uid, token:auth.idToken};
}
function event<K extends keyof Events>(socket: Socket, name: K, timeout = 15_000): Promise<Events[K]> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off(name,done);reject(new Error(`Timeout: ${name}`));},timeout);
    const done=(value: Events[K])=>{clearTimeout(timer);resolve(value);};
    socket.once(name,done);
  });
}
function socket(port: number, auth: unknown) {
  const s=io(`http://127.0.0.1:${port}`, {auth,autoConnect:false,reconnection:false,transports:['websocket']});
  sockets.push(s); return s;
}
try {
  // Concurrent provisioning must create exactly one account, three characters and its first match.
  const accounts=await Promise.all([login(`test-${run}`),login(`test-${run}`)]);
  assert.equal(accounts[0].uid,accounts[1].uid);
  const one=accounts[0], two=await login(`other-${run}`);
  const initial=(await db.collection('players').doc(one.uid).get()).data();
  assert.equal(initial.characters.length,3);
  assert((await db.collection('games').doc(one.uid).get()).exists);
  const boot=await http('bootstrapPlayer',undefined,one.token,true);
  const [player,roster]=await Promise.all([http('getPlayerData',undefined,one.token),http('rosterData',undefined,one.token)]);
  assert.equal(boot.player.uid,one.uid); assert.equal(boot.player.gold,player.gold);
  assert.deepEqual(boot.characters,roster.characters);
  await Promise.all(Array.from({length:6},()=>http('bootstrapPlayer',undefined,one.token,true)));
  const daily=(await db.collection('dailyActiveUsers').doc(new Date().toISOString().slice(0,10)).get()).data();
  assert.equal(daily.storeUsers.filter((uid: string)=>uid===one.uid).length,1);
  assert.equal((await db.collection('players').doc(one.uid).get()).data().lastStoreActiveDay,new Date().toISOString().slice(0,10));
  const denied=await fetch(`${api}/bootstrapPlayer`); assert.equal(denied.status,401);
  // A reset account keeps its fixed-ID characters and practice match; signing in again must
  // still recreate a loadable player rather than fail on those leftovers.
  const reset=await login(`reset-${run}`);
  await db.collection('players').doc(reset.uid).delete();
  const restored=await login(`reset-${run}`);
  assert((await db.collection('players').doc(restored.uid).get()).exists, 'Reset account was not recreated');
  assert.equal((await http('bootstrapPlayer',undefined,restored.token,true)).characters.length,3);
  const invalid=socket(13000,{token:'invalid'}); const rejection=event(invalid,'connect_error'); invalid.connect(); await rejection;
  // First practice uses the provisioned match and requires the render acknowledgement.
  const practice=socket(13123,{token:one.token,gameId:'0',combatReady:1});
  let turn=false; practice.on('turnee',()=>{turn=true;});
  const first=event(practice,'gameStatus'); const started=performance.now();practice.connect();const snapshot=await first;
  timings.practiceSnapshotMs=Math.round(performance.now()-started);
  assert.equal(snapshot.general.combatStarted,false);assert.equal(snapshot.player.team.length,3);
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(turn,false);
  const turnEvent=event(practice,'turnee');practice.emit('arenaReady',snapshot.general.readyToken);await turnEvent;
  practice.disconnect();
  // A player who is not in the persisted match cannot enter it.
  const outsider=socket(13123,{token:two.token,gameId:one.uid,combatReady:1});
  let leaked=false;outsider.on('gameStatus',()=>{leaked=true;});const disconnected=event(outsider,'disconnect');outsider.connect();await disconnected;assert.equal(leaked,false);
  // New queue path reads ELO directly, matches immediately, and durably records both players.
  const q1=socket(13000,{token:one.token}),q2=socket(13000,{token:two.token});
  const connected=Promise.all([event(q1,'connect'),event(q2,'connect')]);q1.connect();q2.connect();await connected;
  const found1=event(q1,'matchFound'),found2=event(q2,'matchFound');const queueStart=performance.now();
  q1.emit('joinQueue',{mode:PlayMode.CASUAL});q2.emit('joinQueue',{mode:PlayMode.CASUAL});
  const [match1,match2]=await Promise.all([found1,found2]);timings.queueToMatchMs=Math.round(performance.now()-queueStart);
  assert.equal(match1.gameId,match2.gameId);
  const saved=(await db.collection('games').doc(match1.gameId).get()).data();
  assert.deepEqual(new Set(saved.players),new Set([one.uid,two.uid]));
  const actions=await db.collection('players').doc(one.uid).collection('actions').where('actionType','==','gameStart').get();assert(!actions.empty);
  // Both human rosters load, but one ready player cannot start PvP on their own.
  const p1=socket(13123,{token:one.token,gameId:match1.gameId,combatReady:1}),p2=socket(13123,{token:two.token,gameId:match1.gameId,combatReady:1});
  const snapshots=Promise.all([event(p1,'gameStatus'),event(p2,'gameStatus')]);const pvpStart=performance.now();p1.connect();p2.connect();
  const [s1,s2]=await snapshots;timings.pvpSnapshotMs=Math.round(performance.now()-pvpStart);
  assert.equal(s1.opponent.team.length,3);assert.equal(s2.opponent.team.length,3);
  let pvpTurn=false;p1.on('turnee',()=>{pvpTurn=true;});p1.emit('arenaReady',s1.general.readyToken);
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(pvpTurn,false);
  const pvpReady=event(p1,'turnee');p2.emit('arenaReady',s2.general.readyToken);await pvpReady;
  // Rating proximity, league and activity eligibility, on the real Firestore query engine.
  for(let i=0;i<15;i++) {
    const opponent=await http('zombieData?league=0&elo=100');
    assert.equal(opponent.playerData.league,0);assert(Math.abs(opponent.playerData.elo-100)<=16);
    assert.equal(opponent.rosterData.characters.length,3);
  }
  assert.deepEqual(await http('zombieData?league=999&elo=100'),{});
  const recentRef=db.collection('players').doc(`recent-${run}`);
  await recentRef.set({...initial,elo:100,league:99,lastActiveDate:new Date().toISOString().replace('T',' ').slice(0,19)});
  assert.deepEqual(await http('zombieData?league=99&elo=100'),{});
  // Exercise the complete AI battle path, including the HTTP opponent function.
  const aiId=`ai-${run}`;await http('createGame',{gameId:aiId,players:[one.uid],mode:PlayMode.CASUAL_VS_AI,league:0});
  const ai=socket(13123,{token:one.token,gameId:aiId,combatReady:1});const aiState=event(ai,'gameStatus');const aiStart=performance.now();ai.connect();
  const aiSnapshot=await aiState;timings.aiSnapshotMs=Math.round(performance.now()-aiStart);assert.equal(aiSnapshot.opponent.team.length,3);
  console.log('Backend integration passed:',JSON.stringify(timings));
} finally {
  sockets.forEach(s=>{s.disconnect();});
  await db.terminate();
}
