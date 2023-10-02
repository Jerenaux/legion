import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";


export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});

export const leaderboardData = onRequest((request, response) => {
    response.send([
        { rank: 1, player: 'Player1', elo: 1500, wins: 10, losses: 2,  winsRatio: Math.round((10/(10+2))*100) + '%', crowdScore: 5 },
        { rank: 2, player: 'Player2', elo: 1400, wins: 8, losses: 3, winsRatio: Math.round((8/(8+3))*100) + '%',  crowdScore: 3 },
        { rank: 3, player: 'Me', elo: 1300, wins: 7, losses: 3, winsRatio: Math.round((7/(7+3))*100) + '%',  crowdScore: 3 },
        // Add more dummy data here
      ]);
  });