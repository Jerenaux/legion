// One-off repair for the old inactive-player job. Dry-run writes a private rollback plan;
// --apply uses that exact plan and refuses to overwrite a concurrently changed player.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const requireAPI = createRequire(require('node:path').resolve(__dirname, '../../api/functions/package.json'));
const {initializeApp, applicationDefault} = requireAPI('firebase-admin/app');
const {getFirestore, Timestamp} = requireAPI('firebase-admin/firestore');
const projectId = 'legion-32c6d';
const databaseId = 'legion';
const repairId = 'synthetic-stats-2026-10-09';
const [planPath, flag] = process.argv.slice(2);
assert(planPath && (!flag || flag === '--apply'), 'Usage: node tools/backend/repair-synthetic-stats.cjs <plan.json> [--apply]');
initializeApp({projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : {credential: applicationDefault()})});
const db = getFirestore(databaseId);
const fields = ['elo', 'lastActiveDate', 'engagementStats.completedGames', 'leagueStats', 'allTimeStats', 'syntheticStatsRepair'];
async function main() {
  if (flag === '--apply') {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.projectId, projectId);
    assert.equal(plan.databaseId, databaseId);
    assert.equal(plan.repairId, repairId);
    assert.equal(plan.emulator, process.env.FIRESTORE_EMULATOR_HOST || null);
    let applied = 0;
    for (const entry of plan.entries) {
      const ref = db.collection('players').doc(entry.id);
      const current = await ref.get();
      if (current.data()?.syntheticStatsRepair?.id === repairId) continue;
      await ref.update(entry.patch, {lastUpdateTime: new Timestamp(entry.updateTime.seconds, entry.updateTime.nanoseconds)});
      applied++;
    }
    console.log(JSON.stringify({applied, planned: plan.entries.length}));
    return;
  }
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const snapshot = await db.collection('players').where('engagementStats.completedGames', '<', 2).select(...fields).get();
  const entries = [];
  const unresolved = [];
  for (const doc of snapshot.docs) {
    const before = doc.data();
    if (before.syntheticStatsRepair || !(before.lastActiveDate < cutoff)) continue;
    const lifetime = before.allTimeStats;
    const weekly = before.leagueStats;
    if (!lifetime || !weekly || ![lifetime.wins, lifetime.losses, lifetime.nbGames, weekly.wins, weekly.losses, weekly.nbGames].every(n => Number.isInteger(n) && n >= 0) ||
        lifetime.nbGames !== lifetime.wins + lifetime.losses || weekly.nbGames !== weekly.wins + weekly.losses) {
      unresolved.push({id: doc.id, reason: 'inconsistent counters'});
      continue;
    }
    const history = await doc.ref.collection('actions').where('actionType', '==', 'reward').select('details.elo').get();
    const deltas = history.docs.map(action => action.data().details?.elo).filter(delta => delta !== undefined && delta !== 0);
    // Do not infer missing real matches or double-count duplicated reward logs.
    if (!deltas.every(Number.isInteger) || deltas.filter(delta => delta > 0).length !== lifetime.wins || deltas.filter(delta => delta < 0).length !== lifetime.losses) {
      unresolved.push({id: doc.id, reason: 'reward history does not match lifetime results'});
      continue;
    }
    const realElo = 100 + deltas.reduce((sum, delta) => sum + delta, 0);
    // Real ranked results always advance one streak; the synthetic job leaves both at zero.
    const synthetic = weekly.nbGames > 0 && weekly.winStreak === 0 && weekly.lossesStreak === 0;
    const wins = synthetic ? weekly.wins : 0;
    const losses = synthetic ? weekly.losses : 0;
    const games = wins + losses;
    const elo = realElo + (games ? Math.round((wins / games - 0.45) * 100) : 0);
    if (!synthetic && before.elo === realElo) continue;
    assert(lifetime.wins + wins > 0 || elo <= 100, 'A zero-win record cannot gain ELO');
    entries.push({id: doc.id, before, updateTime: {seconds: doc.updateTime.seconds, nanoseconds: doc.updateTime.nanoseconds}, patch: {
      elo,
      'allTimeStats.wins': lifetime.wins + wins,
      'allTimeStats.losses': lifetime.losses + losses,
      'allTimeStats.nbGames': lifetime.nbGames + games,
      syntheticStatsRepair: {id: repairId, recoveredWins: wins, recoveredLosses: losses, realElo},
    }});
  }
  fs.writeFileSync(planPath, JSON.stringify({projectId, databaseId, repairId, emulator: process.env.FIRESTORE_EMULATOR_HOST || null, entries, unresolved}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  console.log(JSON.stringify({scanned: snapshot.size, planned: entries.length, unresolved: unresolved.length,
    recoveredWins: entries.reduce((sum, entry) => sum + entry.patch.syntheticStatsRepair.recoveredWins, 0),
    recoveredLosses: entries.reduce((sum, entry) => sum + entry.patch.syntheticStatsRepair.recoveredLosses, 0)}));
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
