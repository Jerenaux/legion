import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware} from "./APIsetup";
import * as functions from "firebase-functions";

export const fetchLeaderboard = onRequest((request, response) => {
  logger.info("Fetching leaderboard");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const docSnap = await db.collection("players").get();
      const players = docSnap.docs.map((doc) => doc.data());
      const sortedPlayers = players.sort((a, b) => b.elo - a.elo);
      const leaderboard = sortedPlayers.map((player, index) => {
        const denominator = player.wins + player.losses;
        let winsRatio = 0;
        if (denominator === 0) {
          winsRatio = 0;
        } else {
          winsRatio = Math.round((player.wins/denominator)*100);
        }
        return {
          rank: index + 1,
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

