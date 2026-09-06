import {onRequest} from "firebase-functions/v2/https";

import admin, {corsMiddleware, getUID} from "./APIsetup";
import {currentSeasonId, LEADERBOARD_LIMIT, RankedPlayer, rankPlayers} from "./ranking";
import {LeaderboardHighlight} from "@legion/shared/interfaces";

function secondsUntilNextSeason(now = new Date()): number {
  const next = new Date(now);
  const daysUntilFriday = (5 - now.getUTCDay() + 7) % 7;
  next.setUTCDate(now.getUTCDate() + daysUntilFriday);
  next.setUTCHours(19, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}

function getHighlights(players: RankedPlayer[], isAllTime: boolean): LeaderboardHighlight[] {
  if (!players.length) return [];

  const highest = (metric: "avgGrade" | "avgAudienceScore" | "winStreak") => players.reduce((best, player) => {
    const bestStats = isAllTime ? best.allTimeStats : best.leagueStats;
    const playerStats = isAllTime ? player.allTimeStats : player.leagueStats;
    return playerStats[metric] > bestStats[metric] ? player : best;
  });

  const highlights: LeaderboardHighlight[] = [
    {player: highest("avgGrade"), title: "Ace Player", description: "Highest Game Grades"},
    {player: highest("avgAudienceScore"), title: "Crowd Favorite", description: "Highest Audience Scores"},
    {player: highest("winStreak"), title: "Unstoppable", description: "Longest Win Streak"},
  ].map(({player, title, description}) => ({
    name: player.name,
    avatar: player.avatar,
    id: player.id,
    title,
    description,
  }));

  if (isAllTime) {
    const highestElo = players.reduce((best, player) => player.elo > best.elo ? player : best);
    highlights.push({
      name: highestElo.name,
      avatar: highestElo.avatar,
      id: highestElo.id,
      title: "Highest Rated",
      description: "Player with the highest ELO",
    });
  }
  return highlights;
}

async function getPersonalRank(leagueID: number, uid: string): Promise<number | null> {
  const db = admin.firestore();
  const playerDoc = await db.collection("players").doc(uid).get();
  if (!playerDoc.exists) return null;
  const player = playerDoc.data()!;

  if (leagueID === 5) {
    const higher = await db.collection("players").where("elo", ">", player.elo || 0).count().get();
    return higher.data().count + 1;
  }

  const stats = player.leagueStats;
  const seasonId = currentSeasonId();
  if (player.league !== leagueID || stats?.seasonId !== seasonId) return null;
  const base = db.collection("players")
    .where("league", "==", leagueID)
    .where("leagueStats.seasonId", "==", seasonId);
  const [moreWins, tiedWithFewerLosses] = await Promise.all([
    base.where("leagueStats.wins", ">", stats.wins || 0).count().get(),
    base.where("leagueStats.wins", "==", stats.wins || 0)
      .where("leagueStats.losses", "<", stats.losses || 0).count().get(),
  ]);
  return moreWins.data().count + tiedWithFewerLosses.data().count + 1;
}

async function getLeaderboard(leagueID: number, uid: string) {
  const db = admin.firestore();
  const isAllTime = leagueID === 5;
  const seasonId = currentSeasonId();
  let query: FirebaseFirestore.Query = db.collection("players");

  if (isAllTime) {
    query = query.orderBy("elo", "desc");
  } else {
    query = query
      .where("league", "==", leagueID)
      .where("leagueStats.seasonId", "==", seasonId)
      .orderBy("leagueStats.wins", "desc")
      .orderBy("leagueStats.losses", "asc")
      .orderBy("elo", "desc");
  }

  const [snapshot, playerRank] = await Promise.all([
    query.limit(LEADERBOARD_LIMIT).get(),
    getPersonalRank(leagueID, uid),
  ]);
  const players = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})) as RankedPlayer[];

  return {
    league: leagueID,
    seasonEnd: isAllTime ? -1 : secondsUntilNextSeason(),
    playerRank,
    highlights: getHighlights(players, isAllTime),
    ranking: rankPlayers(players, isAllTime, uid),
  };
}

export const fetchLeaderboard = onRequest({memory: "512MiB"}, (request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const tabId = Number(request.query.tab);
      if (!Number.isInteger(tabId) || tabId < 0 || tabId > 5) {
        response.status(400).send("Invalid leaderboard tab");
        return;
      }
      response.send(await getLeaderboard(tabId, uid));
    } catch (error) {
      console.error("fetchLeaderboard error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});
