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
    ]);
});

export const inventoryData = onRequest((request, response) => {
  const inventories: { [key: string]: number[] } = {
    '0': [0,0,0,2,5],
    '1': [1,1,1,3,6],
  }

  if (typeof request.query.playerId === 'string') {
    const playerId: string = request.query.playerId;
    response.send(inventories[playerId]);
  } else {
    response.status(400).send('Bad Request: Invalid playerId');
  }
});

