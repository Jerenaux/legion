import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import * as functions from "firebase-functions";
import { firestore } from 'firebase-admin';
import {League, ChestColor} from "@legion/shared/enums";
import {logPlayerAction} from "./dashboardAPI";
import {DBPlayerData} from "@legion/shared/interfaces";

interface APILeaderboardResponse {
  seasonEnd: number;
  promotionRows: number;
  demotionRows: number;
  highlights: any[];
  ranking: LeaderboardRow[];
}

interface LeaderboardHighlight {
  name: string;
  avatar: string;
  description: string;
  title: string
}
interface LeaderboardRow {
  rank: number;
  player: string;
  elo: number;
  wins: number;
  losses: number;
  winsRatio: string;
  isPlayer: boolean;
  chestColor: ChestColor | null;
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


async function getLeagueLeaderboard(uid: string, leagueID: number) {
  const db = admin.firestore();
  const isAllTime = leagueID === 5;

  let seasonEnd = -1;
  let promotionRows = 0;
  let demotionRows = 0;

  if (!isAllTime) {
    seasonEnd = getSecondsUntilEndOfWeek();
  }

  let query = isAllTime ? db.collection("players") : db.collection("players").where("league", "==", leagueID);
  query = query.orderBy(isAllTime ? "allTimeStats.rank" : "leagueStats.rank", "asc");

  const docSnap = await query.get();
  const players: Player[] = docSnap.docs.map((doc) => ({id: doc.id, ...doc.data()})) as Player[];
  console.log(`Fetched ${players.length} players`);

  if (!isAllTime) {
    const initialPromotionRows = Math.ceil(players.length * 0.2); // TODO: make config param
    const initialDemotionRows = leagueID == 0 ? 0 : Math.floor(players.length * 0.2);
    console.log(`[fetchLeaderboard] Initial promotion rows: ${initialPromotionRows}, initial demotion rows: ${initialDemotionRows}`);

    // Calculate promotion rows considering ties
    if (players.length > 0) {
      promotionRows = initialPromotionRows;
      const promotionScore = players[initialPromotionRows - 1].leagueStats.wins;
      for (let i = initialPromotionRows; i < players.length; i++) {
        if (players[i].leagueStats.wins === promotionScore) {
          promotionRows++;
        } else {
          break;
        }
      }

      // Calculate demotion rows considering ties
      demotionRows = initialDemotionRows;
      if (demotionRows) {
        const demotionScore = players[players.length - initialDemotionRows].leagueStats.wins;
        for (let i = players.length - initialDemotionRows - 1; i >= 0; i--) {
          if (players[i].leagueStats.wins === demotionScore) {
            demotionRows++;
          } else {
            break;
          }
        }
      }
    }
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

  const highestAvgGradePlayer = getHighlightPlayer("avgGrade");
  const highestAvgScorePlayer = getHighlightPlayer("avgAudienceScore");
  const highestWinStreakPlayer = getHighlightPlayer("winStreak");

  const highlights: LeaderboardHighlight[] = [];

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


  const leaderboard: APILeaderboardResponse = {
    seasonEnd,
    promotionRows,
    demotionRows,
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

    let chest = null;
    if (!isAllTime) {
      if (player.leagueStats.rank === 1) {
        chest = ChestColor.GOLD;
      } else if (player.leagueStats.rank === 2) {
        chest = ChestColor.SILVER;
      } else if (player.leagueStats.rank === 3) {
        chest = ChestColor.BRONZE;
      }
    }

    return {
      rank: statsObject.rank,
      player: player.name,
      elo: player.elo,
      wins: statsObject.wins,
      losses: statsObject.losses,
      winsRatio: winsRatio + "%",
      avatar: player.avatar,
      isPlayer: player.id === uid,
      chestColor: chest,
    } as LeaderboardRow;
  });
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
      const leaderboard = await getLeagueLeaderboard(uid, tabId);
      logPlayerAction(uid, "fetchLeaderboard", {tabId});
      response.send(leaderboard);
    } catch (error) {
      console.error("fetchLeaderboard error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const leaguesUpdate = functions.pubsub.schedule("* * * * *")
  .onRun(async (context) => {
    logger.info("Updating leagues");
    const db = admin.firestore();

    /**
     * Bronze: 0-999
     * Silver: 1000-1199
     * Gold: 1200-1399
     * Zenith: 1400-1599
     * Apex: 1600+
     */

    try {
      const docSnap = await db.collection("players").get();
      const players = docSnap.docs.map((doc) => doc.data());
      // Iterate over all players and update their league based on their elo
      players.forEach((player) => {
        if (player.elo < 1000) {
          player.league = 0;
        } else if (player.elo < 1200) {
          player.league = 1;
        } else if (player.elo < 1400) {
          player.league = 2;
        } else if (player.elo < 1600) {
          player.league = 3;
        } else {
          player.league = 4;
        }
        db.collection("players").doc(player.uid)
          .update({league: player.league});
      });
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
          const league = newValue.league;
          return updateRanks(league);
      }
      return null;
});

export const updateRanksOnPlayerCreation = functions.firestore
  .document("players/{playerId}")
  .onCreate((snap, context) => {
      console.log("New player created, updating ranks");
      const newValue = snap.data();
      const league = newValue.league;
      return updateRanks(league);
});


type RankingCriteria = {
  whereClause?: [string, firestore.WhereFilterOp, any];
  orderByFields: { field: string; direction: 'asc' | 'desc' }[];
  rankField: string;
};

async function updateRanks(league: League) {
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

  criteria.orderByFields.forEach(({ field, direction }) => {
    // @ts-ignore
    query = query.orderBy(field, direction);
  });

  if (criteria.whereClause) {
    // @ts-ignore
    query = query.where(...criteria.whereClause);
  }

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
