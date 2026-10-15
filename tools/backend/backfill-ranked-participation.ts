// Deploy migration: retain real current/recent-season participants, not synthetic results.
import type {Firestore, QueryDocumentSnapshot} from '../../api/functions/node_modules/@google-cloud/firestore';
import type {LeagueStats} from '../../shared/interfaces';
import {createRequire} from 'node:module';
import {currentSeasonId} from '../../shared/leagueRanking';
import {FIRESTORE_DATABASE_ID} from '../../shared/config';
const requireAPI = createRequire(new URL('../../api/functions/package.json', import.meta.url));
const {initializeApp, applicationDefault} = requireAPI('firebase-admin/app');
const {getFirestore} = requireAPI('firebase-admin/firestore');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: bun tools/backend/backfill-ranked-participation.ts [--apply]');
initializeApp({projectId: 'legion-32c6d', ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : {credential: applicationDefault()})});
const db: Firestore = getFirestore(FIRESTORE_DATABASE_ID);
const current = currentSeasonId();
const previous = currentSeasonId(new Date(Date.now() - 7 * 86400_000));
const apply = process.argv.includes('--apply');
// Every real ranked result advances one streak. The retired synthetic writer left both at zero.
const eligible = (stats: Partial<LeagueStats> | undefined) => stats?.seasonId >= previous && stats.seasonId <= current &&
  stats.hasRankedResult !== true && stats.nbGames > 0 && (stats.winStreak > 0 || stats.lossesStreak > 0);
const query = db.collection('players').where('leagueStats.seasonId', '>=', previous)
  .where('leagueStats.seasonId', '<=', current).select('leagueStats').limit(250);
let cursor: QueryDocumentSnapshot | undefined;
let scanned = 0;
let marked = 0;
for (;;) {
  const page = await (cursor ? query.startAfter(cursor) : query).get();
  if (page.empty) break;
  scanned += page.size;
  for (const doc of page.docs) {
    if (!eligible(doc.data().leagueStats)) continue;
    if (!apply) { marked++; continue; }
    marked += await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(doc.ref);
      if (!eligible(fresh.data()?.leagueStats)) return 0;
      transaction.update(doc.ref, {'leagueStats.hasRankedResult': true});
      return 1;
    });
  }
  cursor = page.docs.at(-1);
}
console.log(JSON.stringify({apply, scanned, marked}));
