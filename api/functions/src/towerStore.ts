import {randomUUID} from 'node:crypto';
import admin from 'firebase-admin';
import {PlayMode, GameStatus} from '@legion/shared/enums';
import {createTowerRun, chooseTowerUpgrade, finishTowerBattle, towerTerminal, towerXP,
  TOWER_ENCOUNTERS, TOWER_MAX_TIER, TowerRun, TowerBattleResult} from '@legion/shared/tower';

export class TowerActionError extends Error {}

export async function towerAction(db: FirebaseFirestore.Firestore, uid: string, body: Record<string, unknown> | null) {
  const playerRef = db.collection('players').doc(uid);
  const runRef = playerRef.collection('tower').doc('current');
  return db.runTransaction(async transaction => {
    const [playerDoc, runDoc] = await Promise.all([transaction.get(playerRef), transaction.get(runRef)]);
    if (!playerDoc.exists) throw new TowerActionError('Player not found.');
    const highestClear = playerDoc.get('towerHighestClear') || 0;
    let run = (runDoc.data() as TowerRun) || null;
    if (body === null) return {run, highestClear};
    const {action, revision, runId, tier, kit, upgrade, encounter} = body || {};
    if (action === 'create') {
      // A retried creation resumes the existing run instead of replacing it.
      if (run && !towerTerminal(run)) return {run, highestClear};
      if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > Math.min(TOWER_MAX_TIER, highestClear + 1) ||
          !['balanced', 'control'].includes(String(kit)) || (kit === 'control' && highestClear < 1)) throw new TowerActionError('That expedition is not unlocked.');
      run = createTowerRun(randomUUID(), tier as number, kit as 'balanced' | 'control');
    } else {
      if (!run || run.id !== runId || run.revision !== revision) throw new TowerActionError('Your expedition changed. Refresh to continue.');
      if (action === 'upgrade') {
        if (run.phase !== 'choice' || !run.offers.includes(String(upgrade))) throw new TowerActionError('That preparation is not available.');
        chooseTowerUpgrade(run, String(upgrade));
      }
      else if (action === 'battle') {
        if (run.phase === 'battle') return {run, highestClear};
        if (run.phase !== 'ready' || !TOWER_ENCOUNTERS[run.floor]?.some(item => item.id === encounter)) throw new TowerActionError('That route is not available.');
        const gameId = `tower-${randomUUID()}`;
        run.phase = 'battle';
        run.path.push(String(encounter));
        run.gameId = gameId;
        run.revision++;
        transaction.create(db.collection('games').doc(gameId), {
          gameId, date: new Date(), players: [uid], mode: PlayMode.TOWER, league: 0,
          status: GameStatus.ONGOING, tower: run,
        });
      } else if (action === 'retire') {
        if (run.phase === 'battle') throw new TowerActionError('Finish or abandon the current battle first.');
        if (towerTerminal(run)) return {run, highestClear};
        run.phase = 'retired'; run.revision++;
      } else throw new TowerActionError('Unknown expedition action.');
    }
    transaction.set(runRef, run);
    return {run, highestClear};
  });
}

export async function settleTowerBattle(db: FirebaseFirestore.Firestore, gameId: string, result: TowerBattleResult) {
  return db.runTransaction(async transaction => {
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists || gameDoc.get('mode') !== PlayMode.TOWER) throw new Error('Unknown tower battle');
    if (gameDoc.get('towerSettled')) return; // Reward and progress commit exactly once.
    const uid = gameDoc.get('players')[0];
    const playerRef = db.collection('players').doc(uid);
    const runRef = playerRef.collection('tower').doc('current');
    const [playerDoc, runDoc] = await Promise.all([transaction.get(playerRef), transaction.get(runRef)]);
    const run = runDoc.data() as TowerRun;
    if (!playerDoc.exists || !run || run.gameId !== gameId || run.id !== gameDoc.get('tower').id) throw new Error('Stale tower result');
    const reward = finishTowerBattle(run, result as TowerBattleResult);
    const player = playerDoc.data()!;
    const refs: FirebaseFirestore.DocumentReference[] = player.characters || [];
    const characters = refs.length && reward.xp ? await transaction.getAll(...refs) : [];
    // No match count, league result, ELO, daily keys, or main-roster consumable write.
    transaction.update(playerRef, {
      gold: admin.firestore.FieldValue.increment(reward.gold),
      xp: admin.firestore.FieldValue.increment(reward.xp),
      towerHighestClear: run.phase === 'won' ? Math.max(player.towerHighestClear || 0, run.tier) : player.towerHighestClear || 0,
    });
    const inventory = player.inventory || {};
    for (const type of ['consumable', 'spell', 'equipment'] as const) {
      const ids = reward.items.filter(item => item.type === type).map(item => item.id);
      if (ids.length) {
        const field = type === 'consumable' ? 'consumables' : type === 'spell' ? 'spells' : 'equipment';
        transaction.update(playerRef, {[`inventory.${field}`]: [...(inventory[field] || []), ...ids]});
      }
    }
    characters.forEach((doc, index) => {
      if (doc.exists) transaction.update(doc.ref, towerXP(doc.data() as Parameters<typeof towerXP>[0],
        Math.floor(reward.xp / characters.length) + (index < reward.xp % characters.length ? 1 : 0)));
    });
    transaction.set(runRef, run);
    transaction.update(gameRef, {towerSettled: true, status: GameStatus.COMPLETED, end: new Date(), towerWon: result.won});
  });
}
