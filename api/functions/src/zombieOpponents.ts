import {readRoster} from './characterAPI';
import type {DocumentReference, Firestore} from 'firebase-admin/firestore';

// Two indexed, bounded queries preserve both sides of the requested rating.
// League remains a matchmaking filter, never a value derived from ELO.
export async function findZombieOpponent(db: Firestore, elo: number, league: number, now = new Date(), random = Math.random) {
  const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  let eligible = db.collection('players').where('lastActiveDate', '<', cutoff);
  if (league !== -1) eligible = eligible.where('league', '==', league);
  const fields = ['name', 'elo', 'lvl', 'avatar', 'league', 'leagueStats', 'allTimeStats', 'dailyloot', 'characters'];
  const [above, below] = await Promise.all([
    eligible.where('elo', '>=', elo).orderBy('elo', 'asc').orderBy('lastActiveDate').limit(10).select(...fields).get(),
    eligible.where('elo', '<', elo).orderBy('elo', 'desc').orderBy('lastActiveDate').limit(10).select(...fields).get(),
  ]);
  const candidates = [...above.docs, ...below.docs]
    .filter(doc => (doc.get('characters') || []).length > 0)
    .sort((a, b) => Math.abs(a.get('elo') - elo) - Math.abs(b.get('elo') - elo)).slice(0, 10);
  const selected = candidates[Math.floor(random() * candidates.length)];
  return selected ? {id: selected.id, data: selected.data()} : undefined;
}

const rosters = new Map<string, {expires: number; value: ReturnType<typeof readRoster>}>();
export function readZombieRoster(playerId: string, references: DocumentReference[]) {
  const key = playerId + ':' + references.map(ref => ref.path).join(',');
  const existing = rosters.get(key);
  if (existing && Date.now() < existing.expires) return existing.value;
  if (rosters.size >= 100) rosters.delete(rosters.keys().next().value!);
  const value = readRoster(references).catch(error => {
    if (rosters.get(key)?.value === value) rosters.delete(key);
    throw error;
  });
  rosters.set(key, {expires: Date.now() + 30_000, value});
  return value;
}
