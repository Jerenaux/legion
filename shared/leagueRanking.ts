import {currentSeasonId} from "./season";

export {currentSeasonId};

/** Written only by a recorded ranked result, never by account creation or synthetic stats. */
export function hasRankedParticipation(stats: {seasonId?: string; hasRankedResult?: boolean} | undefined, seasonId = currentSeasonId()): boolean {
  return stats?.seasonId === seasonId && stats.hasRankedResult === true;
}

// Informational rank only: count players ahead without loading the league or writing ranks.
export async function getLeagueRank(
  db: FirebaseFirestore.Firestore,
  player: {league?: number; leagueStats?: {seasonId?: string; hasRankedResult?: boolean; wins?: number; losses?: number}},
  seasonId = currentSeasonId(),
): Promise<number | null> {
  const stats = player.leagueStats;
  if (!stats || player.league === undefined || !hasRankedParticipation(stats, seasonId)) return null;
  const base = db.collection("players")
    .where("league", "==", player.league)
    .where("leagueStats.seasonId", "==", seasonId)
    .where("leagueStats.hasRankedResult", "==", true);
  const [moreWins, tiedWithFewerLosses] = await Promise.all([
    base.where("leagueStats.wins", ">", stats.wins || 0).count().get(),
    base.where("leagueStats.wins", "==", stats.wins || 0)
      .where("leagueStats.losses", "<", stats.losses || 0).count().get(),
  ]);
  return moreWins.data().count + tiedWithFewerLosses.data().count + 1;
}
