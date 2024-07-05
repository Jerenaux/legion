import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {fetchLeaderboard, leaguesUpdate, updateRanksOnEloChange,
  updateRanksOnPlayerCreation} from "./leaderboardsAPI";
import {inventoryData, purchaseItem, inventoryTransaction, inventorySave, getReward}
  from "./inventoryAPI";
import {rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters,
  deleteOnSaleCharacters, purchaseCharacter, spendSP} from "./characterAPI";
import {createPlayer, getPlayerData, queuingData,
  saveGoldReward, claimChest} from "./playerAPI";
import {createGame, gameData, completeGame} from "./gameAPI";
import {getDashboardData, getActionLog, logQueuingActivity} from "./dashboardAPI";
export {
  fetchLeaderboard, inventoryData, purchaseItem,
  createPlayer, rosterData, characterData, rewardsUpdate,
  generateOnSaleCharacters, listOnSaleCharacters, deleteOnSaleCharacters,
  purchaseCharacter, leaguesUpdate, getPlayerData, queuingData, createGame,
  gameData, inventorySave, inventoryTransaction, saveGoldReward, spendSP,
  getReward, claimChest, updateRanksOnEloChange, updateRanksOnPlayerCreation,
  completeGame, getDashboardData, getActionLog, logQueuingActivity,
};

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});
