import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {fetchLeaderboard, leaguesUpdate} from "./leaderboardsAPI";
import {inventoryData, purchaseItem, equipItem, unequipItem}
  from "./inventoryAPI";
import {rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters,
  deleteOnSaleCharacters, purchaseCharacter} from "./characterAPI";
import {createPlayer, playerData, queuingData} from "./playerAPI";
import {createGame, gameData} from "./gameAPI";

export {
  fetchLeaderboard, inventoryData, purchaseItem, equipItem, unequipItem,
  createPlayer, rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters, deleteOnSaleCharacters,
  purchaseCharacter, leaguesUpdate, playerData, queuingData, createGame,
  gameData,
};

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});
