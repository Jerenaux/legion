import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {fetchLeaderboard} from "./leaderboardsAPI";
import {inventoryData, purchaseItem, equipItem, unequipItem}
  from "./inventoryAPI";
import {createUserCharacter, rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters} from "./characterAPI";

export {
  fetchLeaderboard, inventoryData, purchaseItem, equipItem, unequipItem,
  createUserCharacter, rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters,
};

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});
