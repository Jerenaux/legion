import {onRequest} from "firebase-functions/v2/https";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import * as functions from "firebase-functions";
import { firestore } from 'firebase-admin';
import { addWeeks, setDay, setHours, setMinutes, setSeconds, differenceInSeconds } from 'date-fns';

import {League, ChestColor} from "@legion/shared/enums";
import {logPlayerAction} from "./dashboardAPI";
import {awardChestContent} from "./playerAPI";
import {DBPlayerData, LeaderboardRow} from "@legion/shared/interfaces";
import {PROMOTION_RATIO, DEMOTION_RATIO, SEASON_END_CRON} from "@legion/shared/config";
interface APILeaderboardResponse {
  league: number;
  seasonEnd: number;
  highlights: any[];
  ranking: LeaderboardRow[];
}

interface LeaderboardHighlight {
  name: string;
  avatar: string;
  description: string;
  title: string
}

interface Player extends DBPlayerData{
  id: string;
}

function getSecondsUntilEndOfWeek(): number {
  const now = new Date();

  // Create a new Date object for the upcoming Sunday at midnight
  const endOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const daysUntilSunday = 7 - dayOfWeek; // Days remaining until the next Sunday

  // Set endOfWeek to the upcoming Sunday at midnight
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 0); // Set to midnight

  // Calculate the difference in milliseconds
  const millisecondsUntilEndOfWeek = endOfWeek.getTime() - now.getTime();

  // Convert milliseconds to seconds
  const secondsUntilEndOfWeek = Math.floor(millisecondsUntilEndOfWeek / 1000);

  return secondsUntilEndOfWeek;
}

function getSecondsUntilNextOccurrence(cronExpression: string): number {
  const [minute, hour, , , dayOfWeek] = cronExpression.split(/\s+/);
  console.log(`[getSecondsUntilNextOccurrence] cronExpression: ${cronExpression}, minute: ${minute}, hour: ${hour}, dayOfWeek: ${dayOfWeek}`);

  const now = new Date();
  let target = new Date(now);

  // Set the day of the week (0-6, where 0 is Sunday)
  target = setDay(target, parseInt(dayOfWeek) % 7);

  // Set the hour and minute
  target = setHours(target, parseInt(hour));
  target = setMinutes(target, parseInt(minute));
  target = setSeconds(target, 0);

  // If the target time is in the past, add a week
  if (target <= now) {
    target = addWeeks(target, 1);
  }
  console.log(`[getSecondsUntilNextOccurrence] now: ${now}, target: ${target}`);

  // Calculate the difference in seconds
  const secondsLeft = differenceInSeconds(target, now);

  return secondsLeft;
}

async function getLeagueLeaderboard(leagueID: number, rankingOnly: boolean, uid?: string) {
  const db = admin.firestore();
  const isAllTime = leagueID === 5;

  let seasonEnd = -1;
  let promotionRank = 0;
  let demotionRank = 0;

  if (!isAllTime) {
    seasonEnd = getSecondsUntilNextOccurrence(SEASON_END_CRON);
  }

  let query = isAllTime ? db.collection("players") : db.collection("players").where("league", "==", leagueID);
  query = query.orderBy(isAllTime ? "allTimeStats.rank" : "leagueStats.rank", "asc");

  const docSnap = await query.get();
  const players: Player[] = docSnap.docs.map((doc) => ({id: doc.id, ...doc.data()})) as Player[];
  console.log(`[getLeagueLeaderboard]Fetched ${players.length} players`);

  if (!isAllTime) {
    promotionRank = Math.max(Math.ceil(players.length * PROMOTION_RATIO), 3);
    demotionRank = leagueID == 0 ? 0 : players.length - Math.floor(players.length * DEMOTION_RATIO);
  }

  const getHighlightPlayer = (metric: string) => {
    return players.reduce((prev, current) => {
      // @ts-ignore
      const prevMetric = isAllTime ? prev.allTimeStats[metric] : prev.leagueStats[metric];
      // @ts-ignore
      const currentMetric = isAllTime ? current.allTimeStats[metric] : current.leagueStats[metric];
      return (prevMetric > currentMetric) ? prev : current;
    }, players[0]);
  };

  let highestAvgGradePlayer;
  let highestAvgScorePlayer;
  let highestWinStreakPlayer;
  const highlights: LeaderboardHighlight[] = [];

  if (!rankingOnly) {
    highestAvgGradePlayer = getHighlightPlayer("avgGrade");
    highestAvgScorePlayer = getHighlightPlayer("avgAudienceScore");
    highestWinStreakPlayer = getHighlightPlayer("winStreak");

    if (highestAvgGradePlayer) {
      highlights.push({
        name: highestAvgGradePlayer.name,
        avatar: highestAvgGradePlayer.avatar,
        title: "Ace Player",
        description: `Highest Game Grades`,
      });
    }

    if (highestAvgScorePlayer) {
      highlights.push({
        name: highestAvgScorePlayer.name,
        avatar: highestAvgScorePlayer.avatar,
        title: "Crowd Favorite",
        description: `Highest Audience Scores`,
      });
    }

    if (highestWinStreakPlayer) {
      highlights.push({
        name: highestWinStreakPlayer.name,
        avatar: highestWinStreakPlayer.avatar,
        title: "Unstoppable",
        description: `Longest Win Streak`,
      });
    }

    if (isAllTime) {
      const richestPlayer = players.reduce((prev, current) => {
        return (prev.gold > current.gold) ? prev : current;
      }, players[0]);
      if (richestPlayer) {
        highlights.push({
          name: richestPlayer.name,
          avatar: richestPlayer.avatar,
          title: "Richest Player",
          description: `Player witht the most gold`,
        });
      }
    }
  }

  const leaderboard: APILeaderboardResponse = {
    league: leagueID,
    seasonEnd,
    highlights,
    ranking: [],
  };

  leaderboard.ranking = players.map((player, index) => {
    const statsObject = isAllTime ? player.allTimeStats : player.leagueStats;

    const denominator = statsObject.wins + statsObject.losses;
    let winsRatio = 0;
    if (denominator === 0) {
      winsRatio = 0;
    } else {
      winsRatio = Math.round((statsObject.wins/denominator)*100);
    }

    const hasPlayedGames = statsObject.wins + statsObject.losses > 0;

    const canGetChest = hasPlayedGames && statsObject.wins > 0;

    let chest = null;
    if (!isAllTime && canGetChest) {
      if (player.leagueStats.rank === 1) {
        chest = ChestColor.GOLD;
      } else if (player.leagueStats.rank === 2) {
        chest = ChestColor.SILVER;
      } else if (player.leagueStats.rank === 3) {
        chest = ChestColor.BRONZE;
      }
    }

    // Only mark as promoted if not in the highest league (4) and has played games and has at least one victory
    const isPromoted = 
      leagueID !== 4 &&
      hasPlayedGames &&
      statsObject.wins > 0 &&
      statsObject.rank <= promotionRank;
    // Only mark as demoted if not in the lowest league (0)
    const isDemoted = leagueID !== 0 && hasPlayedGames && statsObject.rank >= demotionRank;

    return {
      rank: statsObject.rank,
      player: player.name,
      elo: player.elo,
      wins: statsObject.wins,
      losses: statsObject.losses,
      winsRatio: winsRatio + "%",
      avatar: player.avatar,
      isPlayer: player.id === uid,
      playerId: rankingOnly ? player.id : null,
      chestColor: chest,
      isFriend: false,
      isPromoted: isPromoted,
      isDemoted: isDemoted,
    } as LeaderboardRow;
  });
  if (rankingOnly) {
    // Only return the ranking, of which only the rows for promoted or demoted players
    return leaderboard.ranking.filter((row) => row.isPromoted || row.isDemoted);
  }
  return leaderboard;
}

export const fetchLeaderboard = onRequest((request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const tabId = parseInt(request.query.tab as string);

      if (typeof tabId !== "number" || isNaN(tabId)) {
        throw new Error("Invalid tab ID");
      }
      const leaderboard = await getLeagueLeaderboard(tabId, false, uid);
      logPlayerAction(uid, "fetchLeaderboard", {tabId});
      response.send(leaderboard);
    } catch (error) {
      console.error("fetchLeaderboard error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

async function updateLeagues(specificLeague?: number) {
  console.log(`[updateLeagues] Updating leagues${specificLeague !== undefined ? ` for league ${specificLeague}` : ''}`);
  const db = admin.firestore();
  const leaguesToUpdate = specificLeague !== undefined ? [specificLeague] : [0, 1, 2, 3, 4];
  const updatedPlayers = new Set<string>();

  // First step: Handle promotions/demotions and chest rewards
  for (const leagueID of leaguesToUpdate) {
    const players = await getLeagueLeaderboard(leagueID, true) as LeaderboardRow[];
    console.log(`[updateLeagues] Found ${players.length} players to update for league ${leagueID}`);

    await db.runTransaction(async (transaction) => {
      const playerUpdates = players.map((player) => {
        if (updatedPlayers.has(player.playerId!)) {
          return null; // Skip players who have already been updated
        }

        let newLeague = player.isPromoted ? leagueID + 1 : player.isDemoted ? leagueID - 1 : leagueID;
        newLeague = Math.max(0, Math.min(4, newLeague)); // TODO: use enum values

        // if (newLeague === leagueID) {
        //   return null;
        // }

        updatedPlayers.add(player.playerId!); // Add player ID to the set of updated players

        const playerRef = db.collection('players').doc(player.playerId!);

        if (player.chestColor) {
          awardChestContent(playerRef, player.chestColor);
        }

        return {
          ref: playerRef,
          data: {
            league: newLeague,
          },
        };
      }).filter((update) => update !== null);

      playerUpdates.forEach((update) => {
        if (update) {
          transaction.update(update.ref, update.data);
        }
      });
    });
  }

  // Second step: Reset leagueStats for all players
  const allPlayersSnapshot = await db.collection('players').get();
  const batchSize = 500;
  let batch = db.batch();
  let operationCount = 0;

  console.log(`[updateLeagues] Resetting leagueStats for ${allPlayersSnapshot.size} players`);

  for (const doc of allPlayersSnapshot.docs) {
    batch.update(doc.ref, {
      leagueStats: getEmptyLeagueStats()
    });
    operationCount++;

    if (operationCount >= batchSize) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  // Finally, update ranks for all leagues
  for (const leagueID of leaguesToUpdate) {
    await updateRanks(leagueID);
  }
}

export function getEmptyLeagueStats(rank = 1) {
  return {
    rank,
    wins: 0,
    losses: 0,
    winStreak: 0,
    lossesStreak: 0,
    nbGames: 0,
    avgAudienceScore: 0,
    avgGrade: 0,
  };
}

export const manualLeaguesUpdate = onRequest((request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const league = request.query.league ? parseInt(request.query.league as string) : undefined;
      
      // Validate league parameter if provided
      if (league !== undefined && (isNaN(league) || league < 0 || league > 4)) {
        throw new Error("Invalid league parameter. Must be between 0 and 4.");
      }

      await updateLeagues(league);
      response.send(`Leagues updated${league !== undefined ? ` for league ${league}` : ''}`);
    } catch (error) {
      console.error("manualLeaguesUpdate error:", error);
      response.status(400).send(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  });
});

export const leaguesUpdate = functions.pubsub.schedule(SEASON_END_CRON)
  .onRun(async (context) => {
    try {
      await updateLeagues(undefined);
    } catch (error) {
      console.error("leaguesUpdate error:", error);
    }
  });

export const updateRanksOnEloChange = functions.firestore
  .document("players/{playerId}")
  .onUpdate((change, context) => {
      const newValue = change.after.data();
      const previousValue = change.before.data();

      // Check if ELO has changed
      if (newValue.elo !== previousValue.elo || newValue.leagueStats.wins !== previousValue.leagueStats.wins) {
          const league = newValue.league as League;
          if (league === undefined) {
              console.error("League is undefined for player", context.params.playerId);
              return null;
          }
          return updateRanks(league);
      }
      return null;
});

export const updateRanksOnPlayerCreation = functions.firestore
  .document("players/{playerId}")
  .onCreate((snap, context) => {
      console.log("New player created, updating ranks");
      const newValue = snap.data();
      let league = newValue.league as League;
      if (league === undefined) {
        league = League.BRONZE;
      }
      return updateRanks(league);
});


type RankingCriteria = {
  whereClause?: [string, firestore.WhereFilterOp, any];
  orderByFields: { field: string; direction: 'asc' | 'desc' }[];
  rankField: string;
};

async function updateRanks(league: League | undefined) {
  if (league === undefined) {
    console.error("League parameter is undefined");
    return;
  }

  console.log(`Updating ranks for league ${league}`);
  const db = admin.firestore();
  const batch = db.batch();

  const leagueRankingCriteria: RankingCriteria = {
    whereClause: ["league", "==", league],
    orderByFields: [
      { field: "leagueStats.wins", direction: "desc" },
      { field: "leagueStats.losses", direction: "asc" },
    ],
    rankField: "leagueStats.rank",
  };

  const allTimeRankingCriteria: RankingCriteria = {
    orderByFields: [{ field: "elo", direction: "desc" }],
    rankField: "allTimeStats.rank",
  };

  await updateRankingsForCriteria(db, batch, leagueRankingCriteria);
  await updateRankingsForCriteria(db, batch, allTimeRankingCriteria);

  return batch.commit();
}

async function updateRankingsForCriteria(
  db: firestore.Firestore,
  batch: firestore.WriteBatch,
  criteria: RankingCriteria
) {
  let query = db.collection('players');

  if (criteria.whereClause) {
    const [field, op, value] = criteria.whereClause;
    if (value !== undefined) {  // Add this check
      // @ts-ignore
      query = query.where(field, op, value);
    }
  }

  criteria.orderByFields.forEach(({ field, direction }) => {
    // @ts-ignore
    query = query.orderBy(field, direction);
  });

  const snapshot = await query.get();
  const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  let rank = 1;
  let previousScores: number[] | null = null;

  players.forEach((player, index) => {
    const currentScores = criteria.orderByFields.map(({ field }) => getNestedProperty(player, field));

    if (previousScores !== null && !areScoresEqual(currentScores, previousScores, criteria.orderByFields)) {
      rank++;
    }

    const playerRef = db.collection('players').doc(player.id);
    batch.update(playerRef, { [criteria.rankField]: rank });

    previousScores = currentScores;
  });
}

function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function areScoresEqual(
  currentScores: number[],
  previousScores: number[],
  orderByFields: { field: string; direction: 'asc' | 'desc' }[]
): boolean {
  return currentScores.every((score, index) => {
    if (orderByFields[index].direction === 'desc') {
      return score === previousScores[index];
    } else {
      return score === previousScores[index];
    }
  });
}
