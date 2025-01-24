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
  setPlayerOnSteroids, zombieData, recordPlayerAction, updateInactivePlayersStats,
  setUtmSource, getProfileData, searchPlayers, migrateLowercaseNames,
  listFriends, addFriend, updatePlayerName, updatePlayerAvatar, incrementStartedGames,
  incrementCompletedGames} from "./playerAPI";
import { createLobby, joinLobby, cancelLobby, listLobbies, getLobbyDetails, countLobbies } from "./lobbyAPI";
import {createGame, completeGame, addNews, getNews, saveReplay, getReplay} from "./gameAPI";
import {getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog, listPlayerIDs, getEngagementMetrics, getTutorialDropoffStats,
  migrateEngagementMetrics, migrateMetricsToStats, getPlayerGameHistory, getActivePlayers,
  migrateMobileFlag, getPlayerActionsReport, migrateCharacterSpeed} from "./dashboardAPI";
import { checkAPIKey, isDevelopment } from "./APIsetup";

export {
  fetchLeaderboard, inventoryData, purchaseItem,
  createPlayer, rosterData, characterData, postGameUpdate,
  generateOnSaleCharacters, listOnSaleCharacters, deleteOnSaleCharacters,
  purchaseCharacter, leaguesUpdate, getPlayerData, queuingData, createGame,
  inventorySave, inventoryTransaction, saveGoldReward, spendSP,
  getReward, claimChest, updateRanksOnEloChange, updateRanksOnPlayerCreation,
  completeGame, getDashboardData, getActionLog, logQueuingActivity, insertGameAction,
  getGameLog, completeTour, fetchGuideTip, manualLeaguesUpdate,
  registerAddress, createLobby, joinLobby, cancelLobby, listLobbies, setPlayerOnSteroids,
  zombieData, getLobbyDetails, countLobbies, addNews, getNews, recordPlayerAction,
  listPlayerIDs, getEngagementMetrics, getTutorialDropoffStats, saveReplay, getReplay,
  migrateEngagementMetrics, migrateMetricsToStats, updateInactivePlayersStats, getPlayerGameHistory,
  setUtmSource, getProfileData, searchPlayers, migrateLowercaseNames, listFriends, addFriend,
  updatePlayerName, updatePlayerAvatar, getActivePlayers, migrateMobileFlag, getPlayerActionsReport,
  migrateCharacterSpeed, incrementStartedGames, incrementCompletedGames
};

export const helloWorld = onRequest({ secrets: ["API_KEY"] }, (request, response) => {
  response.send(`
    API online - 
    [isDevelopment: ${isDevelopment}] - 
    [NODE_ENV: ${process.env.NODE_ENV}] - 
    [API KEY check: ${checkAPIKey(request)}]
    ${request.headers["x-api-key"]}`);
});
