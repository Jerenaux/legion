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
const {GameStatus, PlayMode, Class, InventoryType, InventoryActionType} = await import('../../shared/enums');
const {FIRESTORE_DATABASE_ID} = await import('../../shared/config');
initializeApp({projectId: 'legion-32c6d'});
const db = getFirestore(FIRESTORE_DATABASE_ID);
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
  // Inactive/seeded opponents can receive results without ever bootstrapping daily loot.
  for (const [index, dailyloot, key] of [
    [0, undefined, null],
    [1, undefined, 'bronze'],
    [2, {bronze: {time: 1234, hasKey: true}}, 'silver'],
    [3, {bronze: {time: 1234, hasKey: true}, silver: {time: 5678, hasKey: false}, gold: {time: 9012, hasKey: false}}, 'gold'],
  ] as const) {
    const ref = db.collection('players').doc(`reward-${run}-${index}`);
    await ref.set({gold: 10, xp: 5, elo: 2, characters: [], ...(dailyloot ? {dailyloot} : {})});
    const reward = {uid: ref.id, resultId: `reward-${run}-${index}`, mode: PlayMode.CASUAL_VS_AI,
      stayedUntilTheEnd: false, engagement: {}, outcomes: {
        isWinner: true, xp: 7, gold: 3, elo: 1, characters: [], key,
        chests: [{color: 'bronze', content: [{type: 'gold', id: -1, amount: 11}, {type: 'consumable', id: 10, amount: 1}]}],
      }};
    const started = Date.now() / 1000;
    await Promise.all([http('postGameUpdate', reward), http('postGameUpdate', reward)]);
    const saved = (await ref.get()).data();
    assert.equal(saved.gold, 24);
    assert.equal(saved.xp, 12);
    assert.equal(saved.elo, 3);
    assert.deepEqual(saved.inventory.consumables, [10]);
    assert.equal(saved.casualStats.nbGames, 1);
    for (const [color, delay] of [['bronze', 21600], ['silver', 43200], ['gold', 86400]] as const) {
      const previous = dailyloot?.[color];
      const chest = saved.dailyloot[color];
      assert.equal(chest.hasKey, color === key || previous?.hasKey === true);
      if (previous) assert.equal(chest.time, previous.time);
      else assert(chest.time >= started + delay && chest.time <= Date.now() / 1000 + delay);
    }
    await http('postGameUpdate', reward);
    assert.deepEqual((await ref.get()).data(), saved, 'A retried result must not grant rewards or reset timers twice');
    assert.equal((await db.collection('processedGameResults').where('uid', '==', ref.id).get()).size, 1);
    await ref.delete();
  }
  console.log('Post-match rewards initialize missing chest data, preserve existing timers/keys, and apply once under concurrent retries');
  // A reset account keeps its fixed-ID characters and practice match; signing in again must
  // still recreate a loadable player rather than fail on those leftovers.
  const reset=await login(`reset-${run}`);
  await db.collection('players').doc(reset.uid).delete();
  const restored=await login(`reset-${run}`);
  assert((await db.collection('players').doc(restored.uid).get()).exists, 'Reset account was not recreated');
  assert.equal((await http('bootstrapPlayer',undefined,restored.token,true)).characters.length,3);
  // Equipment ignores character level; spell learning still enforces level, class and capacity.
  const gearAccount = await login(`gear-${run}`);
  const gearPlayerRef = db.collection('players').doc(gearAccount.uid);
  const gearPlayer = (await gearPlayerRef.get()).data();
  const gearCharacters = await Promise.all(gearPlayer.characters.map(ref => ref.get()));
  const warrior = gearCharacters.find(doc => doc.data().class === Class.WARRIOR);
  const mage = gearCharacters.find(doc => doc.data().class === Class.BLACK_MAGE);
  assert.equal(warrior.data().level, 1);
  assert.equal(mage.data().level, 1);
  await gearPlayerRef.update({'inventory.equipment': [0, 21], 'inventory.spells': [2, 5]});
  const equip = (characterId: string, inventoryType: string, index: number) =>
    http('inventoryTransaction', {characterId, inventoryType, index, action: InventoryActionType.EQUIP}, gearAccount.token);
  assert.equal((await equip(mage.id, InventoryType.EQUIPMENTS, 0)).status, 1);
  assert.equal((await equip(mage.id, InventoryType.EQUIPMENTS, 1)).status, 0);
  assert.equal((await mage.ref.get()).data().equipment.left_ring, 21);
  assert.equal((await equip(warrior.id, InventoryType.EQUIPMENTS, 0)).status, 0);
  assert.equal((await warrior.ref.get()).data().equipment.weapon, 0);
  await warrior.ref.update({level: 20});
  assert.equal((await equip(warrior.id, InventoryType.SPELLS, 0)).status, 1);
  await mage.ref.update({skills: [], skill_slots: 1});
  assert.equal((await equip(mage.id, InventoryType.SPELLS, 0)).status, 1);
  assert.deepEqual((await mage.ref.get()).data().skills, []);
  await mage.ref.update({level: 20});
  assert.equal((await equip(mage.id, InventoryType.SPELLS, 0)).status, 0);
  assert.deepEqual((await mage.ref.get()).data().skills, [2]);
  assert.equal((await equip(mage.id, InventoryType.SPELLS, 0)).status, 1);
  assert.deepEqual((await gearPlayerRef.get()).data().inventory.spells, [5]);
  // The scheduled job persists synthetic weekly/lifetime results atomically and is retry-safe.
  const inactiveRef = db.collection('players').doc(`inactive-${run}`);
  const playedRef = db.collection('players').doc(`inactive-ranked-${run}`);
  const inactive = {
    lastActiveDate: '2020-01-01 00:00:00', elo: 0,
    engagementStats: {completedGames: 1},
    leagueStats: {wins: 0, losses: 0, nbGames: 0},
    allTimeStats: {wins: 4, losses: 3, nbGames: 7},
  };
  await inactiveRef.set(inactive);
  await playedRef.set({...inactive, leagueStats: {wins: 1, losses: 0, nbGames: 1}});
  const runInactiveJob = async () => {
    const response = await fetch(`${api}/updateInactivePlayersStats-0`, {method: 'POST'});
    assert(response.ok, await response.text());
  };
  await Promise.all([runInactiveJob(), runInactiveJob()]);
  const synthetic = (await inactiveRef.get()).data();
  const weekly = synthetic.leagueStats;
  assert(weekly.nbGames >= 1 && weekly.nbGames <= 50);
  assert.equal(weekly.wins + weekly.losses, weekly.nbGames);
  assert.equal(synthetic.allTimeStats.wins, 4 + weekly.wins);
  assert.equal(synthetic.allTimeStats.losses, 3 + weekly.losses);
  assert.equal(synthetic.allTimeStats.nbGames, 7 + weekly.nbGames);
  assert.equal(synthetic.elo, Math.round((weekly.wins / weekly.nbGames - 0.45) * 100));
  assert(weekly.seasonId);
  await runInactiveJob();
  assert.deepEqual((await inactiveRef.get()).data(), synthetic);
  assert.deepEqual((await playedRef.get()).data(), {...inactive, leagueStats: {wins: 1, losses: 0, nbGames: 1}});
  await Promise.all([inactiveRef.delete(), playedRef.delete()]);
  // Exercise the maintenance CLI against real Firestore, including stale-plan protection.
  {
    const {execFileSync, spawnSync} = await import('node:child_process');
    const {mkdtempSync, readFileSync, rmSync} = await import('node:fs');
    const {tmpdir} = await import('node:os');
    const {join} = await import('node:path');
    const directory = mkdtempSync(join(tmpdir(), 'legion-stats-repair-'));
    const script = new URL('./repair-synthetic-stats.cjs', import.meta.url).pathname;
    const ref = db.collection('players').doc(`repair-${run}`);
    const zeroRef = db.collection('players').doc(`repair-zero-${run}`);
    const ambiguousRef = db.collection('players').doc(`repair-ambiguous-${run}`);
    const repairable = {...inactive, elo: 400,
      leagueStats: {wins: 8, losses: 3, nbGames: 11, winStreak: 0, lossesStreak: 0, avgGrade: 0, avgAudienceScore: 0},
      allTimeStats: {wins: 1, losses: 2, nbGames: 3},
    };
    await ref.set(repairable);
    await Promise.all([15, -10, -8].map(elo => ref.collection('actions').add({actionType: 'reward', details: {elo}})));
    await zeroRef.set({...repairable, leagueStats: {...repairable.leagueStats, wins: 0, losses: 1, nbGames: 1}, allTimeStats: {wins: 0, losses: 0, nbGames: 0}});
    await ambiguousRef.set(repairable);
    const cli = (file: string, apply = false) => execFileSync(process.execPath, [script, file, ...(apply ? ['--apply'] : [])], {env: process.env});
    try {
      const stale = join(directory, 'stale.json');
      cli(stale);
      await ref.update({elo: 401});
      assert.notEqual(spawnSync(process.execPath, [script, stale, '--apply'], {env: process.env}).status, 0);
      assert.equal((await ref.get()).data().elo, 401);
      const plan = join(directory, 'plan.json');
      cli(plan);
      assert(JSON.parse(readFileSync(plan, 'utf8')).unresolved.some(entry => entry.id === ambiguousRef.id));
      cli(plan, true);
      const repaired = (await ref.get()).data();
      assert.equal(repaired.elo, 97 + Math.round((8 / 11 - 0.45) * 100));
      assert.deepEqual(repaired.allTimeStats, {wins: 9, losses: 5, nbGames: 14});
      assert.deepEqual(repaired.engagementStats, inactive.engagementStats);
      assert.equal((await zeroRef.get()).data().elo, 55);
      assert.deepEqual((await ambiguousRef.get()).data(), repairable);
      cli(plan, true);
      assert.deepEqual((await ref.get()).data(), repaired);
    } finally {
      rmSync(directory, {recursive: true, force: true});
      await Promise.all([ref, zeroRef, ambiguousRef].map(ref => db.recursiveDelete(ref)));
    }
  }
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
  // Completion must accept canceled/partial matches and persist every action before
  // the HTTP response. Previously an undefined result rejected after the response.
  const completedBefore = (await db.collection('players').doc(one.uid).get()).data().completedGames;
  for (const results of [{}, {[one.uid]: {audience: 100, score: 10}}, {
    [one.uid]: {audience: 100, score: 10}, [two.uid]: {audience: 50, score: 5},
  }]) {
    const gameId = `complete-${crypto.randomUUID()}`;
    await http('createGame', {gameId, players: [one.uid, two.uid], mode: PlayMode.CASUAL, league: 0});
    const winnerUID = Object.keys(results).length ? one.uid : '';
    await http('completeGame', {gameId, winnerUID, results});
    const completed = (await db.collection('games').doc(gameId).get()).data();
    assert.equal(completed.status, GameStatus.COMPLETED);
    assert.deepEqual(completed.results, results);
    assert.equal(completed.winner, winnerUID || null);
    assert(completed.end);
    for (const uid of [one.uid, two.uid]) {
      const logs = await db.collection('players').doc(uid).collection('actions').where('actionType', '==', 'gameComplete').get();
      const action = logs.docs.map(doc => doc.data()).find(action => action.details.gameId === gameId);
      assert(action, 'Completion response arrived before its action record');
      assert.equal(action.details.winner, winnerUID ? winnerUID === uid : null);
      assert.deepEqual(action.details.results, results[uid]);
      assert.equal(Object.hasOwn(action.details, 'results'), Object.hasOwn(results, uid));
    }
  }
  // An old match can omit league; even a corrupt analytics recipient must not
  // prevent the authoritative match from completing or leave a rejected promise.
  const oldGameId = `legacy-complete-${run}`;
  await db.collection('games').doc(oldGameId).set({players: [one.uid, 'invalid/player'], mode: PlayMode.CASUAL_VS_AI});
  const aiResults = {[one.uid]: {audience: 10, score: 1}};
  await http('completeGame', {gameId: oldGameId, winnerUID: '', results: aiResults});
  const oldGame = (await db.collection('games').doc(oldGameId).get()).data();
  assert.equal(oldGame.status, GameStatus.COMPLETED);
  assert.equal(oldGame.winner, -1, 'An actual AI victory retains its existing winner value');
  const oldActions = await db.collection('players').doc(one.uid).collection('actions').where('actionType', '==', 'gameComplete').get();
  const oldAction = oldActions.docs.map(doc => doc.data()).find(action => action.details.gameId === oldGameId);
  assert.equal(oldAction.details.league, null);
  assert.equal(oldAction.details.winner, false);
  assert.equal((await db.collection('players').doc(one.uid).get()).data().completedGames, completedBefore);
  // Operator CLI -> real HTTP redemption -> real Firestore transactions, all on loopback.
  const {execFileSync, spawnSync} = await import('node:child_process');
  const {mkdtempSync, writeFileSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const giftFiles = mkdtempSync(join(tmpdir(), 'legion-gift-smoke-'));
  try {
    const rewards = [{type: 'equipment', id: 2, amount: 1}, {type: 'gold', id: 0, amount: 50}];
    const rewardsFile = join(giftFiles, 'rewards.json');
    writeFileSync(rewardsFile, JSON.stringify(rewards));
    const cliOptions = {cwd: new URL('../../api/functions/', import.meta.url), encoding: 'utf8' as const};
    const cli = (...args: string[]) => JSON.parse(execFileSync('bun', ['tools/gifts.ts', ...args, '--project', 'legion-32c6d'], cliOptions));
    for (const usage of [[], ['--usage', 'invalid']]) {
      const invalid = spawnSync('bun', ['tools/gifts.ts', 'create', '--project', 'legion-32c6d', '--label', 'local', '--rewards', rewardsFile, ...usage], cliOptions);
      assert.equal(invalid.status, 1, 'Creation must require an explicit supported usage');
      assert.equal(invalid.stdout, '');
    }
    const audience = await Promise.all([0, 1, 2].map(n => login(`gift-${n}-${run}`)));
    const before = await Promise.all(audience.map(async account => (await db.collection('players').doc(account.uid).get()).data()));
    const create = (usage: string) => cli('create', '--usage', usage, '--label', `local-${run}`, '--rewards', rewardsFile);
    const single = create('single'), unlimited = create('unlimited'), other = create('unlimited');
    assert.equal(single.usage, 'single'); assert.equal(unlimited.usage, 'unlimited');
    const singles = await Promise.all(audience.slice(0, 2).map(account => http('redeemGift', {token: single.token, usage: 'unlimited'}, account.token)));
    assert.deepEqual(singles.map(result => result.status).sort(), ['claimed', 'unavailable']);
    const winner = singles.findIndex(result => result.status === 'claimed');
    assert.equal((await http('redeemGift', {token: single.token}, audience[winner].token)).status, 'already_claimed');
    const results = await Promise.all(audience.slice(0, 2).flatMap(account => [0, 1, 2].map(() => http('redeemGift', {token: unlimited.token}, account.token))));
    assert.equal(results.filter(result => result.status === 'claimed').length, 2);
    assert.equal(results.filter(result => result.status === 'already_claimed').length, 4);
    const campaign = await db.collection('creatorGifts').doc(unlimited.id).get();
    assert.equal(campaign.get('claimedBy'), null);
    assert.equal((await campaign.ref.collection('claims').get()).size, 2);
    assert.equal(cli('inspect', '--id', unlimited.id).usage, 'unlimited');
    assert(cli('list').some((gift: {id: string}) => gift.id === unlimited.id));
    assert.equal(cli('revoke', '--id', unlimited.id).revokedAt > 0, true);
    assert.equal((await http('redeemGift', {token: unlimited.token}, audience[2].token)).status, 'unavailable');
    assert.deepEqual(await http('redeemGift', {token: unlimited.token}, audience[0].token), {status: 'already_claimed', rewards, community: null});
    assert.equal((await http('redeemGift', {token: other.token}, audience[0].token)).status, 'claimed');
    const after = await Promise.all(audience.map(async account => (await db.collection('players').doc(account.uid).get()).data()));
    for (let i = 0; i < audience.length; i++) {
      const claims = (i === winner ? 1 : 0) + (i < 2 ? 1 : 0) + (i === 0 ? 1 : 0);
      assert.equal(after[i].gold, before[i].gold + 50 * claims);
      assert.equal(after[i].inventory.equipment.length, before[i].inventory.equipment.length + claims);
      assert.deepEqual(after[i].engagementStats, before[i].engagementStats);
    }
    console.log('Gift CLI usage, concurrent single/unlimited redemption, per-account receipts, independent campaigns and revocation pass');

    // One audience link: gift + community invitation, through both operator CLIs and the share page.
    const code = `smoke-${run.slice(0, 8)}`;
    execFileSync('bun', ['tools/communities.ts', 'create', '--project', 'legion-32c6d', '--id', code, '--name', 'Smoke Guild', '--tag', 'SMK'], cliOptions);
    const missing = spawnSync('bun', ['tools/gifts.ts', 'create', '--project', 'legion-32c6d', '--usage', 'unlimited', '--label', 'local', '--rewards', rewardsFile, '--community', 'no-such-community'], cliOptions);
    assert.equal(missing.status, 1, 'A gift cannot invite to an unknown community');
    const invite = cli('create', '--usage', 'unlimited', '--label', `community-${run}`, '--rewards', rewardsFile, '--community', code.toUpperCase());
    assert.equal(invite.communityId, code);
    assert(invite.shareURL.endsWith(`/invite?gift=${invite.token}`));
    const fan = await login(`gift-fan-${run}`);
    const claim = await http('redeemGift', {token: invite.token}, fan.token);
    assert.equal(claim.status, 'claimed');
    assert.equal(claim.community?.id, code);
    // The gift never joins on its own: membership still needs the player's confirmation.
    assert.equal((await db.collection('players').doc(fan.uid).get()).get('community'), undefined);
    assert.equal((await http('joinCommunity', {code, via: 'link'}, fan.token)).id, code);
    assert.equal((await http('redeemGift', {token: invite.token}, fan.token)).community?.id, code);

    const page = async (query: string) => {
      const response = await fetch(`${api}/invite?${query}`, {redirect: 'manual'});
      return {status: response.status, csp: response.headers.get('content-security-policy') || '', html: await response.text()};
    };
    const giftPage = await page(`gift=${invite.token}`);
    assert.equal(giftPage.status, 200);
    assert(giftPage.html.includes(`steam://run/3996730/?gift=${invite.token}`) && giftPage.html.includes('class="sigil"'));
    assert.equal(giftPage.html.split('class="reward ').length - 1, rewards.length);
    assert(!/<script|\sstyle=|\son\w+=/.test(giftPage.html), 'The share page must work under the site CSP');
    assert(giftPage.csp.includes("style-src 'self'") && !giftPage.csp.includes('unsafe'));
    const communityPage = await page(`community=${code}`);
    assert.equal(communityPage.status, 200);
    assert(communityPage.html.includes(`steam://run/3996730/?community=${code}`));
    assert.equal((await page(`gift=${'0'.repeat(64)}`)).status, 404);
    assert.equal((await page('community=x')).status, 404);
    const revoked = (await page(`gift=${unlimited.token}`)).html;
    assert(!revoked.includes(`?gift=${unlimited.token}`), 'Unavailable gifts must not offer a claim button');
    for (const [endpoint, query, target] of [['giftLink', `token=${invite.token}`, `gift=${invite.token}`], ['communityLink', `code=${code}`, `community=${code}`]]) {
      const legacy = await fetch(`${api}/${endpoint}?${query}`, {redirect: 'manual'});
      assert.equal(legacy.status, 302);
      assert.equal(legacy.headers.get('location'), `https://www.play-legion.io/invite?${target}`);
    }
    console.log('Gift community invitations, explicit join, invite page states and legacy link redirects pass');
  } finally { rmSync(giftFiles, {recursive: true, force: true}); }
  console.log('Backend integration passed:',JSON.stringify(timings));
} finally {
  sockets.forEach(s=>{s.disconnect();});
  await db.terminate();
}
