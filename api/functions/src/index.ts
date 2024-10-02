import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {fetchLeaderboard, leaguesUpdate, updateRanksOnEloChange,
  updateRanksOnPlayerCreation, manualLeaguesUpdate} from "./leaderboardsAPI";
import {inventoryData, purchaseItem, inventoryTransaction, inventorySave, getReward}
  from "./inventoryAPI";
import {rosterData, characterData, postGameUpdate,
  generateOnSaleCharacters, listOnSaleCharacters,
  deleteOnSaleCharacters, purchaseCharacter, spendSP} from "./characterAPI";
import {createPlayer, getPlayerData, queuingData,
  saveGoldReward, claimChest, completeTour, fetchGuideTip, registerAddress} from "./playerAPI";
import {createGame, gameData, completeGame, getRemoteConfig} from "./gameAPI";
import {getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog} from "./dashboardAPI";
export {
  fetchLeaderboard, inventoryData, purchaseItem,
  createPlayer, rosterData, characterData, postGameUpdate,
  generateOnSaleCharacters, listOnSaleCharacters, deleteOnSaleCharacters,
  purchaseCharacter, leaguesUpdate, getPlayerData, queuingData, createGame,
  gameData, inventorySave, inventoryTransaction, saveGoldReward, spendSP,
  getReward, claimChest, updateRanksOnEloChange, updateRanksOnPlayerCreation,
  completeGame, getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog, completeTour, fetchGuideTip, manualLeaguesUpdate, getRemoteConfig,
  registerAddress,
};

export const helloWorld = onRequest((request, response) => {
  response.send(`API online - [AdminMode: ${process.env.ADMIN_MODE}] - [NODE_ENV: ${process.env.NODE_ENV}]`);
});
