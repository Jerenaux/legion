import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

import admin, {corsMiddleware, getUID} from "./APIsetup";
import {currentSeasonId, LEADERBOARD_LIMIT, RankedPlayer, rankPlayers, seasonEndingAt} from "./ranking";
import {processChestRewards} from "./characterAPI";
import {ChestColor, League} from "@legion/shared/enums";
import {DBPlayerData, LeaderboardHighlight} from "@legion/shared/interfaces";
import {getChestContent} from "@legion/shared/chests";
import {SEASON_END_CRON} from "@legion/shared/config";

interface LeagueOutcome {
  playerId: string;
  league: League;
  newLeague: League;
  chestColor: ChestColor | null;
}

interface LeagueRollover {
  status: "running" | "completed";
  participants: number;
  outcomes: LeagueOutcome[];
}

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

  const [snapshot, playerRank, participantCountSnapshot] = await Promise.all([
    query.limit(LEADERBOARD_LIMIT).get(),
    getPersonalRank(leagueID, uid),
    isAllTime ? Promise.resolve(null) : query.count().get(),
  ]);
  const players = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})) as RankedPlayer[];
  const participantCount = participantCountSnapshot?.data().count ?? players.length;

  return {
    league: leagueID,
    seasonEnd: isAllTime ? -1 : secondsUntilNextSeason(),
    playerRank,
    highlights: getHighlights(players, isAllTime),
    ranking: rankPlayers(players, isAllTime, uid, isAllTime ? undefined : leagueID as League, participantCount),
  };
}

async function getLeagueOutcomes(seasonId: string): Promise<{participants: number; outcomes: LeagueOutcome[]}> {
  const db = admin.firestore();
  const leagues = [League.BRONZE, League.SILVER, League.GOLD, League.ZENITH, League.APEX];
  const snapshots = await Promise.all(leagues.map((league) => db.collection("players")
    .where("league", "==", league)
    .where("leagueStats.seasonId", "==", seasonId)
    .orderBy("leagueStats.wins", "desc")
    .orderBy("leagueStats.losses", "asc")
    .orderBy("elo", "desc")
    .get()));

  const outcomes: LeagueOutcome[] = [];
  let participants = 0;
  snapshots.forEach((snapshot, league) => {
    participants += snapshot.size;
    const players = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})) as RankedPlayer[];
    const rows = rankPlayers(players, false, undefined, league, snapshot.size);
    rows.forEach((row, index) => {
      if (!row.isPromoted && !row.isDemoted && row.chestColor === null) return;
      outcomes.push({
        playerId: snapshot.docs[index].id,
        league,
        newLeague: (row.isPromoted ? league + 1 : row.isDemoted ? league - 1 : league) as League,
        chestColor: row.chestColor,
      });
    });
  });
  return {participants, outcomes};
}

async function applyLeagueOutcome(outcome: LeagueOutcome, seasonId: string): Promise<boolean> {
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(outcome.playerId);
  const content = outcome.chestColor === null ? [] : getChestContent(outcome.chestColor);
  return db.runTransaction(async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists) return false;
    const player = playerDoc.data() as DBPlayerData;
    if (player.lastLeagueRolloverSeason === seasonId || player.league !== outcome.league) return false;

    transaction.update(playerRef, {
      league: outcome.newLeague,
      lastLeagueRolloverSeason: seasonId,
    });
    if (content.length) {
      await processChestRewards(
        transaction,
        playerRef,
        content,
        [...(player.inventory?.consumables || [])],
        [...(player.inventory?.spells || [])],
        [...(player.inventory?.equipment || [])],
      );
    }
    return true;
  });
}

async function getOrCreateRollover(seasonId: string): Promise<LeagueRollover> {
  const db = admin.firestore();
  const runRef = db.collection("leagueRollovers").doc(seasonId);
  const existing = await runRef.get();
  if (existing.exists) return existing.data() as LeagueRollover;
  const plan = await getLeagueOutcomes(seasonId);
  return db.runTransaction(async (transaction) => {
    const concurrent = await transaction.get(runRef);
    if (concurrent.exists) return concurrent.data() as LeagueRollover;
    // ponytail: one plan document is sufficient at current scale; shard if it approaches Firestore's 1 MiB limit.
    const rollover: LeagueRollover = {status: "running", ...plan};
    transaction.create(runRef, {
      ...rollover,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return rollover;
  });
}

export const leaguesUpdate = onSchedule({
  schedule: SEASON_END_CRON,
  timeZone: "UTC",
  memory: "256MiB",
  cpu: "gcf_gen1",
  minInstances: 0,
  maxInstances: 1,
  concurrency: 1,
  retryCount: 2,
}, async (event) => {
  const db = admin.firestore();
  const seasonId = seasonEndingAt(new Date(event.scheduleTime));
  const rollover = await getOrCreateRollover(seasonId);
  if (rollover.status === "completed") {
    logger.info("Weekly league rollover already completed", {seasonId});
    return;
  }
  const {participants, outcomes} = rollover;
  let updated = 0;
  for (let index = 0; index < outcomes.length; index += 25) {
    const results = await Promise.all(outcomes.slice(index, index + 25)
      .map((outcome) => applyLeagueOutcome(outcome, seasonId)));
    updated += results.filter(Boolean).length;
  }
  await db.collection("leagueRollovers").doc(seasonId).update({
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updated,
  });
  logger.info("Weekly league rollover complete", {
    seasonId,
    participants,
    promotions: outcomes.filter((outcome) => outcome.newLeague > outcome.league).length,
    demotions: outcomes.filter((outcome) => outcome.newLeague < outcome.league).length,
    rewards: outcomes.filter((outcome) => outcome.chestColor !== null).length,
    updated,
  });
});

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
