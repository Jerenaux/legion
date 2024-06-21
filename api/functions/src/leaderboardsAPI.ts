import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware} from "./APIsetup";
import * as functions from "firebase-functions";
import {League, GameStatus} from "@legion/shared/enums";

interface APILeaderboardResponse {
  seasonEnd: number;
  promotionRows: number;
  demotionRows: number;
  ranking: LeaderboardRow[];
}
interface LeaderboardRow {
  rank: number;
  player: string;
  elo: number;
  wins: number;
  losses: number;
  winsRatio: string;
}

export const fetchLeaderboard = onRequest((request, response) => {
  logger.info("Fetching leaderboard");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const tabId = parseInt(request.query.tab as string);
      console.log(`Fetching leaderboard for tab ${tabId}`);
      if (typeof tabId !== "number" || isNaN(tabId)) {
        throw new Error("Invalid tab ID");
      }
      const isAllTime = tabId === 5;

      let seasonEnd = -1;
      let promotionRows = 0;
      let demotionRows = 0;

      if (!isAllTime) {
        // Compute number of seconds until end of the week
        const now = new Date();
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()), 23, 59, 59);
        seasonEnd = Math.floor(endOfWeek.getTime() / 1000);
      }

      const leaderboard: APILeaderboardResponse = {
        seasonEnd,
        promotionRows,
        demotionRows,
        ranking: [],
      };

      const query = isAllTime ? db.collection("players") : db.collection("players").where("league", "==", tabId);

      const docSnap = await query.get();
      const players = docSnap.docs.map((doc) => doc.data());

      if (!isAllTime) {
        promotionRows = Math.ceil(players.length * 0.2);
        demotionRows = Math.floor(players.length * 0.2);
      }

      const sortedPlayers = players.sort((a, b) => b.elo - a.elo);

      leaderboard.ranking = sortedPlayers.map((player, index) => {
        const denominator = player.wins + player.losses;
        let winsRatio = 0;
        if (denominator === 0) {
          winsRatio = 0;
        } else {
          winsRatio = Math.round((player.wins/denominator)*100);
        }
        return {
          rank: isAllTime ? index + 1 : player.rank,
          player: player.name,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
          winsRatio: winsRatio + "%",
        };
      });
      response.send(leaderboard);
    } catch (error) {
      console.error("fetchLeaderboard error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const leaguesUpdate = functions.pubsub.schedule("every 5 seconds")
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
      if (newValue.elo !== previousValue.elo) {
          const league = newValue.league;
          return updateRanksForLeague(league);
      }
      return null;
});

export const updateRanksOnPlayerCreation = functions.firestore
  .document("players/{playerId}")
  .onCreate((snap, context) => {
      console.log("New player created, updating ranks");
      const newValue = snap.data();
      const league = newValue.league;
      return updateRanksForLeague(league);
});


async function updateRanksForLeague(league: League) {
  console.log(`Updating ranks for league ${league}`);
  const db = admin.firestore();
  const playersSnapshot = await db.collection("players")
      .where("league", "==", league)
      .orderBy("elo", "desc")
      .get();

  const batch = db.batch();
  let rank = 1;

  playersSnapshot.forEach((doc) => {
      const playerRef = db.collection("players").doc(doc.id);
      batch.update(playerRef, {rank: rank});
      rank++;
  });

  return batch.commit();
}

export const updateHighlights = functions.firestore
  .document("games/{gameId}")
  .onUpdate((change, context) => {
      const newValue = change.after.data();
      const previousValue = change.before.data();

      // Check if ELO has changed
      if (newValue.status == GameStatus.COMPLETED) {
          // ...
      }
      return null;
});
