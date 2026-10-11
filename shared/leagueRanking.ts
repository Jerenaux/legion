export function currentSeasonId(now = new Date()): string {
  const boundary = new Date(now);
  const daysSinceFriday = (boundary.getUTCDay() + 2) % 7;
  boundary.setUTCDate(boundary.getUTCDate() - daysSinceFriday);
  boundary.setUTCHours(19, 0, 0, 0);
  if (boundary > now) boundary.setUTCDate(boundary.getUTCDate() - 7);
  return boundary.toISOString().slice(0, 10);
}

// Informational rank only: count players ahead without loading the league or writing ranks.
export async function getLeagueRank(
  db: FirebaseFirestore.Firestore,
  player: {league?: number; leagueStats?: {seasonId?: string; wins?: number; losses?: number}},
  seasonId = currentSeasonId(),
): Promise<number | null> {
  const stats = player.leagueStats;
  if (player.league === undefined || stats?.seasonId !== seasonId) return null;
  const base = db.collection("players")
    .where("league", "==", player.league)
    .where("leagueStats.seasonId", "==", seasonId);
  const [moreWins, tiedWithFewerLosses] = await Promise.all([
    base.where("leagueStats.wins", ">", stats.wins || 0).count().get(),
    base.where("leagueStats.wins", "==", stats.wins || 0)
      .where("leagueStats.losses", "<", stats.losses || 0).count().get(),
  ]);
  return moreWins.data().count + tiedWithFewerLosses.data().count + 1;
}
