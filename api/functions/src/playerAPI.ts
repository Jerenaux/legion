import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, { corsMiddleware, getUID, checkAPIKey, performLockedOperation } from "./APIsetup";
import { fetchParsedTransactionWithRetry } from "./lobbyAPI";

import { uniqueNamesGenerator }
  from "unique-names-generator";

import { Class, ChestColor, League, Token } from "@legion/shared/enums";
import { PlayerContextData, DailyLootAllDBData, DailyLootAllAPIData, DBPlayerData,
  PlayerInventory } from "@legion/shared/interfaces";
import { NewCharacter } from "@legion/shared/NewCharacter";
import { getChestContent, ChestReward } from "@legion/shared/chests";
import {
  STARTING_CONSUMABLES, STARTING_GOLD, BASE_INVENTORY_SIZE, STARTING_GOLD_ADMIN,
  STARTING_SPELLS_ADMIN, STARTING_EQUIPMENT_ADMIN, IMMEDIATE_LOOT, RPC, MIN_WITHDRAW,
} from "@legion/shared/config";
import { logPlayerAction, updateDAU } from "./dashboardAPI";
import { getEmptyLeagueStats } from "./leaderboardsAPI";
import { numericalSort } from "@legion/shared/inventory";
import {
  Connection, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram, PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';

const NB_START_CHARACTERS = 3;

const chestsDelays = {
  [ChestColor.BRONZE]: 6 * 60 * 60,
  [ChestColor.SILVER]: 12 * 60 * 60,
  [ChestColor.GOLD]: 24 * 60 * 60,
};

function selectRandomAvatar(): string {
  // Return a random value betweem 1 and 31 included
  return (Math.floor(Math.random() * 31) + 1).toString();
}

const coolAdjectives: string[] = [
  "Fearless", "Mystic", "Swift", "Shadowed", "Blazing",
  "Ancient", "Vengeful", "Arcane", "Radiant", "Savage",
  "Infernal", "Silent", "Crimson", "Lunar", "Stormy",
  "Valiant", "Cunning", "Divine", "Phantom", "Celestial",
  "Feral", "Venomous", "Majestic", "Abyssal", "Noble",
  "Frosty", "Ethereal", "Vigilant", "Obsidian", "Dreadful",
  "Mighty", "Ruthless", "Brave", "Glimmering", "Spectral",
  "Merciless", "Burning", "Thunderous", "Enigmatic",
  "Grim", "Titanic", "Raging", "Wicked", "Radiant",
  "Elusive", "Mystical", "Frozen", "Unyielding", "Temporal",
  "Unseen", "Furious", "Shimmering", "Howling", "Galactic",
  "Daring", "Void", "Zealous", "Ironclad", "Sinister",
  "Tempestuous", "Aegis",
];

const coolNouns: string[] = [
  "Warrior", "Hunter", "Sorcerer", "Knight", "Rogue",
  "Phoenix", "Dragon", "Wolf", "Shadow", "Reaper",
  "Wraith", "Titan", "Guardian", "Berserker", "Valkyrie",
  "Sage", "Beast", "Paladin", "Ranger", "Assassin",
  "Seer", "Giant", "Mystic", "Viper", "Lion",
  "Storm", "Demon", "Specter", "Falcon", "Raven",
  "Blade", "Champion", "Samurai", "Wanderer", "Invoker",
  "Druid", "Ember", "Oracle", "Sentinel",
  "Invoker", "Spellbinder", "Gladiator", "Warlord", "Avenger",
  "Shade", "Thorn", "Predator", "Harbinger",
  "Vanguard", "Nomad", "Crusader", "Stalker", "Enigma",
  "Harpy", "Tempest", "Prophet", "Fury", "Juggernaut",
];


function generateName() {
  const options = {
    dictionaries: [coolAdjectives, coolNouns],
    length: 2,
    separator: " ",
    style: "capital",
  };
  // @ts-ignore
  const base = uniqueNamesGenerator(options);
  return base.length > 16 ? base.slice(0, 16) : base;
}

export const createPlayer = functions.runWith({ memory: '512MB' }).auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(user.uid);
  const now = Date.now() / 1000;
  const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const startLeague = League.BRONZE;
  const isAdmin = (process.env.ADMIN_MODE == 'true');
  console.log(`[createPlayer] isAdmin: ${isAdmin}`);

  const bronzePlayersCount = await db.collection("players")
    .where("league", "==", startLeague)
    .count()
    .get();

  // Define the character data structure
  const playerData = {
    name: generateName(),
    avatar: selectRandomAvatar(),
    joinDate: today,
    lastActiveDate: today,
    gold: isAdmin ? STARTING_GOLD_ADMIN : STARTING_GOLD,
    carrying_capacity: BASE_INVENTORY_SIZE,
    inventory: {
      consumables: STARTING_CONSUMABLES,
      equipment: isAdmin ? STARTING_EQUIPMENT_ADMIN : [],
      spells: isAdmin ? STARTING_SPELLS_ADMIN : [],
    },
    characters: [],
    elo: 100,
    league: startLeague,
    xp: 0,
    lvl: 1,
    dailyloot: {
      [ChestColor.BRONZE]: {
        time: now + chestsDelays.bronze,
        hasKey: false,
      },
      [ChestColor.SILVER]: {
        time: now + chestsDelays.silver,
        hasKey: false,
      },
      [ChestColor.GOLD]: {
        time: now + chestsDelays.gold,
        hasKey: false,
      },
    } as DailyLootAllDBData,
    leagueStats: getEmptyLeagueStats(bronzePlayersCount.data().count + 1),
    allTimeStats: getEmptyLeagueStats(-1),
    casualStats: {
      nbGames: 0,
      wins: 0,
    },
    tours: {
      'play': false,
      'team': false,
      'rank': false,
      'shop': false,
      'queue': false,
    },
    guideTipsShown: [],
    engagementStats: {
      everPurchased: false,
      everSpentSP: false,
      everOpenedDailyLoot: false,
      everEquippedConsumable: false,
      everEquippedEquipment: false,
      everEquippedSpell: false,
      everUsedSpell: false,
      everPlayedPractice: false,
      everPlayedCasual: false,
      everPlayedRanked: false,
    },
    tokens: {
      [Token.SOL]: 0,
    },
    // isGuest: user.providerData.length === 0,
  } as DBPlayerData;

  // Start a batch to ensure atomicity
  const batch = db.batch();

  // Add player document to batch
  batch.set(playerRef, playerData);

  const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
  const characterDataArray = [];

  for (let i = 0; i < NB_START_CHARACTERS; i++) {
    characterDataArray.push(
      new NewCharacter(
        classes[i]
      ).getCharacterData()
    );
  }

  characterDataArray.forEach((characterData) => {
    const characterRef = db.collection("characters").doc();
    batch.set(characterRef, characterData);
    playerData.characters.push(characterRef);
  });

  // Commit the batch
  return batch.commit()
    .then(() => {
      logger.info("New player and characters created for user:", user.uid);
    })
    .catch((error) => {
      logger.info("Error creating player and characters:", error);
    });
});

const transformDailyLoot = (dailyloot: DailyLootAllDBData): DailyLootAllAPIData => {
  const now = Date.now() / 1000;
  const transformedChests: DailyLootAllAPIData = {
    [ChestColor.BRONZE]: { hasKey: false, countdown: 0 },
    [ChestColor.SILVER]: { hasKey: false, countdown: 0 },
    [ChestColor.GOLD]: { hasKey: false, countdown: 0 },
  };
  for (const color of Object.values(ChestColor)) {
    const chest = dailyloot[color];
    const timeLeft = chest.time - now;
    transformedChests[color] = {
      hasKey: chest.hasKey,
      countdown: timeLeft > 0 ? timeLeft : 0,
    };
  }
  return transformedChests;
};


export const getPlayerData = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection('players').doc(uid).get();

      if (docSnap.exists) {
        const playerData = docSnap.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        updateDAU(uid);
        // Update the lastActiveDate field
        const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
        if (playerData.lastActiveDate !== today) {
          await db.collection("players").doc(uid).update({
            lastActiveDate: today,
          });
        }

        // Transform the chest field so that the `time` field becomes
        // a `countdown` field
        playerData.dailyloot = transformDailyLoot(playerData.dailyloot);

        const tours = Object.keys(playerData.tours || {}).filter((tour) => !playerData.tours[tour]);

        const sortedInventory: PlayerInventory = {
          consumables: playerData.inventory.consumables.sort(numericalSort),
          spells: playerData.inventory.spells.sort(numericalSort),
          equipment: playerData.inventory.equipment.sort(numericalSort),
        };

        response.send({
          uid,
          gold: playerData.gold,
          elo: playerData.elo,
          lvl: playerData.lvl,
          name: playerData.name,
          teamName: "teamName",
          avatar: playerData.avatar,
          league: playerData.league,
          rank: playerData.leagueStats.rank,
          wins: playerData.leagueStats.wins,
          allTimeRank: playerData.allTimeStats.rank,
          dailyloot: playerData.dailyloot,
          tours,
          inventory: sortedInventory,
          carrying_capacity: playerData.carrying_capacity,
          isLoaded: false,
          tokens: playerData.tokens,
        } as PlayerContextData);
      } else {
        response.status(404).send(`Player ID ${uid} not found`);
      }
    } catch (error) {
      console.error("playerData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const queuingData = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const playerData = docSnap.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        response.send({
          elo: playerData.elo,
          league: playerData.league,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("queuingData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const saveGoldReward = onRequest({ secrets: ["API_KEY"] }, (request, response) => {
  logger.info("Saving gold reward");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      if (!checkAPIKey(request)) {
        response.status(401).send('Unauthorized');
        return;
      }
      const uid = request.body.uid;
      const gold = request.body.gold;

      const playerRef = db.collection("players").doc(uid);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        throw new Error("Invalid player ID");
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        throw new Error("playerData is null");
      }

      const newGold = playerData.gold + gold;

      await playerRef.update({
        gold: newGold,
      });

      response.send({
        gold: newGold,
      });
    } catch (error) {
      console.error("saveGoldReward error:", error);
      response.status(500).send("Error");
    }
  });
});

export async function awardChestContent(
  playerRef: admin.firestore.DocumentReference,
  chestColor: ChestColor,
) {
  const content: ChestReward[] = getChestContent(chestColor);
  logger.info(`[awardChestContent] Chest content: ${JSON.stringify(content)}`);

  try {
    // First, get the current player data
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      throw new Error('Player document does not exist');
    }
    const playerData = playerDoc.data() as DBPlayerData;

    // Prepare updates
    const updates: { [key: string]: any } = {};
    let goldIncrement = 0;

    for (const reward of content) {
      switch (reward.type) {
        case "gold":
          goldIncrement += (reward.amount || 0);
          break;
        case "consumable":
          if (!updates["inventory.consumables"]) {
            updates["inventory.consumables"] = [...(playerData.inventory?.consumables || [])];
          }
          updates["inventory.consumables"].push(reward.id);
          break;
        case "spell":
          if (!updates["inventory.spells"]) {
            updates["inventory.spells"] = [...(playerData.inventory?.spells || [])];
          }
          updates["inventory.spells"].push(reward.id);
          break;
        case "equipment":
          if (!updates["inventory.equipment"]) {
            updates["inventory.equipment"] = [...(playerData.inventory?.equipment || [])];
          }
          updates["inventory.equipment"].push(reward.id);
          break;
        default:
          logger.warn(`[awardChestContent] Unknown reward type: ${reward.type}`);
      }
    }

    // Apply updates
    if (goldIncrement > 0) {
      updates.gold = admin.firestore.FieldValue.increment(goldIncrement);
    }

    await playerRef.update(updates);

    logger.info(`[awardChestContent] Successfully awarded chest content to player ${playerRef.id}`);
    return content;
  } catch (error) {
    logger.error(`[awardChestContent] Error awarding chest content: ${error}`);
    throw error;
  }
}

export const claimChest = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const chestType = request.query.chestType as keyof DailyLootAllDBData;
      logger.info("Claiming chest for player:", uid, "chestType:", chestType);

      const playerRef = db.collection("players").doc(uid);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        throw new Error("Invalid player ID");
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        throw new Error("playerData is null");
      }

      const chest = playerData.dailyloot[chestType];
      if (!chest) {
        throw new Error("Invalid chest type");
      }

      const now = Date.now() / 1000;
      if (!chest.hasKey && !IMMEDIATE_LOOT) {
        response.status(400).send("Key for chest not owned!");
        return;
      }
      if (chest.time > now && !IMMEDIATE_LOOT) {
        response.status(400).send("Chest is still locked!");
        return;
      }

      const batch = db.batch();

      // Update dailyloot
      playerData.dailyloot[chestType] = {
        time: now + chestsDelays[chestType],
        hasKey: false,
      };
      batch.update(playerRef, {
        dailyloot: playerData.dailyloot,
      });

      // Update utilization stats
      batch.update(playerRef, {
        'engagementStats.everOpenedDailyLoot': true,
      });

      // Commit the batch
      await batch.commit();

      // Award chest content
      const content = await awardChestContent(playerRef, chestType as ChestColor);

      const dailyLootResponse = transformDailyLoot(playerData.dailyloot);
      logPlayerAction(uid, "claimChest", { chestType });
      response.send({
        content,
        dailyloot: dailyLootResponse,
      });
    } catch (error) {
      console.error("claimChest error:", error);
      response.status(500).send("Error");
    }
  });
});

export const completeTour = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const tour = request.body.page;
      logger.info("Completing tour for player:", uid, "tour:", tour);

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          throw new Error("Invalid player ID");
        }

        const playerData = playerDoc.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        playerData.tours[tour as keyof typeof playerData.tours] = true;

        transaction.update(playerRef, {
          tours: playerData.tours,
        });

        response.send({});
      });
    } catch (error) {
      console.error("completeTour error:", error);
      response.status(500).send("Error");
    }
  });
});

const figureOutGuideTip = (playerData: any) => {
  const joinedSince = (new Date().getTime() - new Date(playerData.joinDate).getTime()) / 1000;
  console.log(`[figureOutGuideTip] joinedSince: ${joinedSince}`);
  if (joinedSince < 10) {
    return {
      guideId: -1,
      route: "/play",
    };
  }

  if (!playerData.guideTipsShown.includes(0) &&
    playerData.gold >= STARTING_GOLD * 3 &&
    !playerData.engagementStats.everPurchased) {
    return {
      guideId: 0,
      route: "/shop",
    };
  }

  if (!playerData.guideTipsShown.includes(1) && !playerData.engagementStats.everSpentSP) {
    // Iterate over the characters of the player to find one where sp > 0
    for (const characterRef of playerData.characters) {
      const characterData = characterRef.get();
      if (characterData.sp > 0) {
        return {
          guideId: 1,
          route: `/team/${characterRef.id}`,
        };
      }
    }
  }

  if (!playerData.guideTipsShown.includes(2) && !playerData.engagementStats.everOpenedDailyLoot) {
    // Check in the daily loot of the character if one of the time fields is in the past
    for (const chestType of Object.values(ChestColor)) {
      if (playerData.dailyloot[chestType].time < Date.now() / 1000) {
        return {
          guideId: 2,
          route: "/queue/1",
        };
      }
    }
  }

  // You have unused equipment pieces in your inventory! Click here to go to the team page and equip them!
  if (!playerData.guideTipsShown.includes(3) &&
    playerData.inventory.equipment.length > 0 &&
    !playerData.engagementStats.everEquippedEquipment) {
    return {
      guideId: 3,
      route: "/team",
    };
  }

  // "You have unused consumables in your inventory! Click here to go to the team page and equip them on your characters!",
  if (!playerData.guideTipsShown.includes(4) &&
    playerData.inventory.consumables.length > 3 &&
    !playerData.engagementStats.everEquippedConsumable) {
    return {
      guideId: 4,
      route: "/team",
    };
  }

  // "You have unused spells in your inventory! Click here to go to the team page and teach them to your characters!",
  if (!playerData.guideTipsShown.includes(5) &&
    playerData.inventory.spells.length > 0 &&
    !playerData.engagementStats.everEquippedSpell) {
    return {
      guideId: 5,
      route: "/team",
    };
  }

  // "Not sure what to do? Just click here to start a Practice game and try out your characters and spells!",
  if (!playerData.guideTipsShown.includes(6) &&
    !playerData.engagementStats.everPlayedPractice) {
    return {
      guideId: 6,
      route: "/queue/0",
    };
  }

  // "Now that you know the game a bit more, click here to play against another player in Casual mode!",
  if (!playerData.guideTipsShown.includes(7) &&
    playerData.engagementStats.everPlayedPractice &&
    !playerData.engagementStats.everPlayedCasual) {
    return {
      guideId: 7,
      route: "/queue/1",
    };
  }

  // "You've had a few victories now, why don't you try your luck in Ranked mode and climb the ladder? Click here to start!",
  if (!playerData.guideTipsShown.includes(8) &&
    playerData.casualStats.wins >= 2 &&
    !playerData.engagementStats.everPlayedRanked) {
    return {
      guideId: 8,
      route: "/queue/2",
    };
  }


  return {
    guideId: -1,
    route: "",
  };
};

const figureOutConbatTip = (playerData: any) => {
  // "Your characters know cool spells, this time why don't you give them a try in combat?",
  if (!playerData.guideTipsShown.includes(9) &&
    (playerData.engagementStats.everPlayedPractice || playerData.engagementStats.everPlayedCasual || playerData.engagementStats.everPlayedRanked) &&
    !playerData.engagementStats.everUsedSpell) {
    return {
      guideId: 9,
      route: "",
    };
  }

  return {
    guideId: -1,
    route: "",
  };
};

export const fetchGuideTip = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const combatTip = request.query.combatTip;

      const playerRef = db.collection("players").doc(uid);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        throw new Error("Invalid player ID");
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        throw new Error("playerData is null");
      }

      const { guideId, route } = combatTip ? figureOutConbatTip(playerData) : figureOutGuideTip(playerData);
      // Update the player document to add the guideId to the list of shown tips
      if (guideId !== -1) {
        await playerRef.update({
          guideTipsShown: admin.firestore.FieldValue.arrayUnion(guideId),
        });
      }

      response.send({
        guideId,
        route,
      });
    } catch (error) {
      console.error("fetchGuideTip error:", error);
      response.status(500).send("Error");
    }
  });
});

export const registerAddress = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const address = request.body.address;
      logger.info("Registering address for player:", uid, "address:", address);

      await db.collection("players").doc(uid).update({
        address,
      });

      response.send({});
    } catch (error) {
      console.error("registerAddress error:", error);
      response.status(500).send("Error");
    }
  });
});

export const setPlayerOnSteroids = onRequest({ secrets: ["API_KEY"] }, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      if (!checkAPIKey(request)) {
        response.status(401).send('Unauthorized');
        return;
      }

      const { uid } = request.body;

      // Start a new transaction
      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          throw new Error("Invalid player ID");
        }

        const playerData = playerDoc.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        // Delete existing characters
        for (const characterRef of playerData.characters) {
          transaction.delete(characterRef);
        }

        // Create new characters
        const levelBase = 10;
        const newCharacters = [
          new NewCharacter(Class.WARRIOR, Math.floor(Math.random() * 20) + levelBase),
          new NewCharacter(Class.WHITE_MAGE, Math.floor(Math.random() * 20) + levelBase),
          new NewCharacter(Class.BLACK_MAGE, Math.floor(Math.random() * 20) + levelBase),
          new NewCharacter(Class.BLACK_MAGE, Math.floor(Math.random() * 20) + levelBase),
        ];

        const newCharacterRefs = [];
        for (const character of newCharacters) {
          const characterRef = db.collection("characters").doc();
          const characterData = character.getCharacterData();

          // Add some SP
          characterData.sp = Math.floor(Math.random() * 10) + 1;
          characterData.allTimeSP = characterData.sp;

          // Adjust spells for white mage and black mages
          if (character.characterClass === Class.WHITE_MAGE) {
            characterData.skills = [9, 10, 11];
          } else if (character.characterClass === Class.BLACK_MAGE) {
            characterData.skill_slots = 5;
            characterData.skills = [];
          }

          transaction.set(characterRef, characterData);
          newCharacterRefs.push(characterRef);
        }

        // Distribute spells 1-8 among black mages
        const blackMageRefs = newCharacterRefs.filter((_, index) => index > 1);
        const spells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (const spell of spells) {
          const randomBlackMage = blackMageRefs[Math.floor(Math.random() * blackMageRefs.length)];
          transaction.update(randomBlackMage, {
            skills: admin.firestore.FieldValue.arrayUnion(spell),
          });
        }

        // Update player data
        const newInventory = {
          consumables: [],
          equipment: [],
          spells: [],
        };

        // Add random amounts of consumables
        for (let i = 0; i <= 12; i++) {
          const amount = Math.floor(Math.random() * 3) + 1;
          for (let j = 0; j < amount; j++) {
            // @ts-ignore
            newInventory.consumables.push(i);
          }
        }

        // Add random amounts of equipment
        for (let i = 0; i <= 31; i++) {
          const amount = Math.floor(Math.random() * 2) + 1;
          for (let j = 0; j < amount; j++) {
            // @ts-ignore
            newInventory.equipment.push(i);
          }
        }

        transaction.update(playerRef, {
          characters: newCharacterRefs,
          gold: 35000,
          inventory: newInventory,
        });
      });

      response.send({ message: "Player reset successfully" });
    } catch (error) {
      console.error("resetPlayer error:", error);
      response.status(500).send(`Error resetting player: ${error}`);
    }
  });
});

export const zombieData = onRequest({ secrets: ["API_KEY"] }, async (req, res) => {
  try {
    if (!checkAPIKey(req)) {
      res.status(401).send('Unauthorized');
      return;
    }

    const db = admin.firestore();
    const auth = admin.auth();

    // Get the league and elo parameters from the request
    const league = parseInt(req.query.league as string, 10);
    const targetElo = parseInt(req.query.elo as string, 10);

    if (isNaN(league) || isNaN(targetElo)) {
      res.status(400).json({ error: 'Valid league and elo parameters are required' });
      return;
    }

    // Prepare the query
    let playersQuery = db.collection('players');
    if (league !== -1) {
      // @ts-ignore
      playersQuery = playersQuery.where('league', '==', league);
    }

    // Get all matching player documents
    const playersSnapshot = await playersQuery.get();
    const playerDocs = playersSnapshot.docs;

    // Shuffle the array of player documents
    for (let i = playerDocs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerDocs[i], playerDocs[j]] = [playerDocs[j], playerDocs[i]];
    }

    // Select up to 10 random players
    const selectedPlayers = playerDocs.slice(0, 10);

    // Find the dangling player with the closest ELO
    let closestPlayer = null;
    let closestEloDiff = Infinity;

    for (const playerDoc of selectedPlayers) {
      const playerId = playerDoc.id;
      try {
        await auth.getUser(playerId);
      } catch (error) {
        // @ts-ignore
        if (error.code === 'auth/user-not-found') {
          const playerData = playerDoc.data();
          if (playerData) {
            const eloDiff = Math.abs(playerData.elo - targetElo);
            if (eloDiff < closestEloDiff) {
              closestEloDiff = eloDiff;
              closestPlayer = { id: playerId, data: playerData };
            }
          }
        } else {
          console.error(`Error checking user ${playerId}:`, error);
        }
      }
    }

    if (closestPlayer) {
      const { id: playerId, data: playerData } = closestPlayer;

      // Get character data
      const characterRefs = playerData.characters || [];
      const characterDocs = await db.getAll(...characterRefs, {
        fieldMask: ['name', 'portrait', 'level', 'class', 'experience', 'xp', 'sp', 'stats', 'carrying_capacity',
          'carrying_capacity_bonus', 'skill_slots', 'inventory', 'equipment', 'equipment_bonuses', 'sp_bonuses',
          'skills',
        ],
      });

      const rosterData = characterDocs.map((characterDoc) => ({
        id: characterDoc.id,
        name: characterDoc.get('name'),
        level: characterDoc.get('level'),
        class: characterDoc.get('class'),
        experience: characterDoc.get('experience'),
        portrait: characterDoc.get('portrait'),
        xp: characterDoc.get('xp'),
        sp: characterDoc.get('sp'),
        stats: characterDoc.get('stats'),
        carrying_capacity: characterDoc.get('carrying_capacity'),
        carrying_capacity_bonus: characterDoc.get('carrying_capacity_bonus'),
        skill_slots: characterDoc.get('skill_slots'),
        inventory: characterDoc.get('inventory'),
        equipment: characterDoc.get('equipment'),
        equipment_bonuses: characterDoc.get('equipment_bonuses'),
        sp_bonuses: characterDoc.get('sp_bonuses'),
        skills: characterDoc.get('skills'),
      }));

      console.log(`[zombieData] playerData dailyloot: ${JSON.stringify(playerData.dailyloot)}`);

      // Transform dailyloot
      const transformedDailyLoot = transformDailyLoot(playerData.dailyloot);

      // Prepare tours data
      const tours = Object.keys(playerData.tours || {}).filter((tour) => !playerData.tours[tour]);

      // Sort inventory
      const sortedInventory = {
        consumables: playerData.inventory.consumables.sort(numericalSort),
        spells: playerData.inventory.spells.sort(numericalSort),
        equipment: playerData.inventory.equipment.sort(numericalSort),
      };

      // Prepare the response object
      const responseData = {
        playerData: {
          uid: playerId,
          gold: playerData.gold,
          elo: playerData.elo,
          lvl: playerData.lvl,
          name: playerData.name,
          teamName: "teamName",
          avatar: playerData.avatar,
          league: playerData.league,
          rank: playerData.leagueStats.rank,
          wins: playerData.leagueStats.wins,
          allTimeRank: playerData.allTimeStats.rank,
          dailyloot: transformedDailyLoot,
          tours,
          inventory: sortedInventory,
          carrying_capacity: playerData.carrying_capacity,
          isLoaded: false,
        },
        rosterData: {
          characters: rosterData,
        },
      };

      res.json(responseData);
    } else {
      res.json({ message: `No dangling player IDs found${league !== -1 ? ` in league ${league}` : ''}` });
    }
  } catch (error) {
    console.error('Error in zombieData:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const withdrawSOL = onRequest({ secrets: ["GAME_WALLET_PRIVATE_KEY"] }, async (request, response) => {
  const db = admin.firestore();

  return corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const amount = parseFloat(request.body.amount);
      console.log(`[withdrawSOL] Withdrawing ${amount} SOL for ${uid} on ${RPC}`);

      if (isNaN(amount) || amount < MIN_WITHDRAW) {
        return response.status(400).send({ error: `Invalid withdrawal amount. Minimum is ${MIN_WITHDRAW} SOL.` });
      }

      const result = await performLockedOperation(uid, async () => {
        return db.runTransaction(async (transaction) => {
          
          const playerDocRef = db.collection('players').doc(uid);
          const playerDoc = await transaction.get(playerDocRef);

          if (!playerDoc.exists) {
            throw new Error('Player not found.');
          }

          const playerData = playerDoc.data();
          if (!playerData) {
            throw new Error('Player data is null.');
          }

          const playerAddress = playerData.address;
          const inGameBalance = playerData.tokens?.[Token.SOL] || 0;

          if (!playerAddress) {
            throw new Error('Player wallet address not registered.');
          }

          // Check if the player has enough balance
          if (amount > inGameBalance) {
            throw new Error('Insufficient in-game balance.');
          }

          // Load the game wallet keypair from the environment variable
          const secretKeyString = process.env.GAME_WALLET_PRIVATE_KEY;
          if (!secretKeyString) {
            throw new Error('Game wallet private key not set in environment variables.');
          }

          const secretKey = bs58.decode(secretKeyString);
          const gameWalletKeypair = Keypair.fromSecretKey(secretKey);

          // Create a connection to the Solana cluster
          const connection = new Connection(RPC, 'confirmed');

          // Create a transaction to send SOL from the game wallet to the player
          const withdrawTransaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: gameWalletKeypair.publicKey,
              toPubkey: new PublicKey(playerAddress),
              lamports: Math.round(amount * LAMPORTS_PER_SOL),
            })
          );

          // Sign and send the transaction
          const signature = await connection.sendTransaction(withdrawTransaction, [gameWalletKeypair]);
          console.log(`Withdrawal transaction signature: ${signature}`);

          // Wait for transaction confirmation
          const confirmedTransaction = await fetchParsedTransactionWithRetry(signature, connection);

          if (!confirmedTransaction) {
            throw new Error('Transaction could not be confirmed after retries.');
          }

          // Update the player's in-game balance
          transaction.update(playerDocRef, {
            [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-amount),
          });

          // Record the withdrawal transaction
          const withdrawalRef = db.collection('withdrawals').doc();
          transaction.set(withdrawalRef, {
            uid: uid,
            amount: amount,
            signature: signature,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { success: true, signature: signature };
        });
      });

      return response.status(200).send(result);
    } catch (error) {
      console.error('withdrawSOL error:', error);
      if (error instanceof Error && error.message === 'Failed to acquire lock. Resource is busy.') {
        return response.status(423).send({ error: "Resource is locked. Please try again later." });
      }
      return response.status(500).send({ error: 'An error occurred during withdrawal: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
});

export const recordPlayerAction = onRequest((request, response) => {
  return corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const actionType = request.body.actionType;
      const details = request.body.details;
      logPlayerAction(uid, actionType, details);
      response.status(200).send({});
    } catch (error) {
      console.error('recordPlayerAction error:', error);
      response.status(500).send('An error occurred during recordPlayerAction: ' + (error instanceof Error ? error.message : String(error)));
    }
  });
});
