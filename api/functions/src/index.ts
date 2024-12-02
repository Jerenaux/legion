import {onRequest} from "firebase-functions/v2/https";

import {fetchLeaderboard, leaguesUpdate, updateRanksOnEloChange,
  updateRanksOnPlayerCreation, manualLeaguesUpdate} from "./leaderboardsAPI";
import {inventoryData, purchaseItem, inventoryTransaction, inventorySave, getReward}
  from "./inventoryAPI";
import {rosterData, characterData, postGameUpdate,
  generateOnSaleCharacters, listOnSaleCharacters,
  deleteOnSaleCharacters, purchaseCharacter, spendSP} from "./characterAPI";
import {createPlayer, getPlayerData, queuingData,
  saveGoldReward, claimChest, completeTour, fetchGuideTip, registerAddress,
  setPlayerOnSteroids, zombieData, withdrawSOL, recordPlayerAction, updateInactivePlayersStats} from "./playerAPI";
import { createLobby, joinLobby, cancelLobby, listLobbies, getLobbyDetails, countLobbies } from "./lobbyAPI";
import {createGame, gameData, completeGame, getRemoteConfig, addNews, getNews, saveReplay, getReplay} from "./gameAPI";
import {getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog, listPlayerIDs, getEngagementMetrics, getTutorialDropoffStats,
  migrateEngagementMetrics, migrateMetricsToStats} from "./dashboardAPI";
import { checkAPIKey, isDevelopment } from "./APIsetup";

export {
  fetchLeaderboard, inventoryData, purchaseItem,
  createPlayer, rosterData, characterData, postGameUpdate,
  generateOnSaleCharacters, listOnSaleCharacters, deleteOnSaleCharacters,
  purchaseCharacter, leaguesUpdate, getPlayerData, queuingData, createGame,
  gameData, inventorySave, inventoryTransaction, saveGoldReward, spendSP,
  getReward, claimChest, updateRanksOnEloChange, updateRanksOnPlayerCreation,
  completeGame, getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog, completeTour, fetchGuideTip, manualLeaguesUpdate, getRemoteConfig,
  registerAddress, createLobby, joinLobby, cancelLobby, listLobbies, setPlayerOnSteroids,
  zombieData, withdrawSOL, getLobbyDetails, countLobbies, addNews, getNews, recordPlayerAction,
  listPlayerIDs, getEngagementMetrics, getTutorialDropoffStats, saveReplay, getReplay,
  migrateEngagementMetrics, migrateMetricsToStats, updateInactivePlayersStats
};

export const helloWorld = onRequest({ secrets: ["API_KEY"] }, (request, response) => {
  response.send(`
    API online - 
    [isDevelopment: ${isDevelopment}] - 
    [NODE_ENV: ${process.env.NODE_ENV}] - 
    [API KEY check: ${checkAPIKey(request)}]
    ${request.headers["x-api-key"]}`);
});
