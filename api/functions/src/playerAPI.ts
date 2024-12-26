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
  MAX_NICKNAME_LENGTH,
  NB_START_CHARACTERS,
  MAX_AVATAR_ID
} from "@legion/shared/config";
import { logPlayerAction, updateDAU } from "./dashboardAPI";
import { getEmptyLeagueStats } from "./leaderboardsAPI";
import { numericalSort } from "@legion/shared/inventory";
// import {
//   Connection, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram, PublicKey,
// } from '@solana/web3.js';
// import bs58 from 'bs58';
import { onSchedule } from "firebase-functions/v2/scheduler";

const chestsDelays = {
  [ChestColor.BRONZE]: 6 * 60 * 60,
  [ChestColor.SILVER]: 12 * 60 * 60,
  [ChestColor.GOLD]: 24 * 60 * 60,
};

function getDefaultDailyLoot(): DailyLootAllDBData {
  const now = Date.now() / 1000;
  return {
    [ChestColor.BRONZE]: {
      time: now + chestsDelays[ChestColor.BRONZE],
      hasKey: false,
    },
    [ChestColor.SILVER]: {
      time: now + chestsDelays[ChestColor.SILVER],
      hasKey: false,
    },
    [ChestColor.GOLD]: {
      time: now + chestsDelays[ChestColor.GOLD],
      hasKey: false,
    },
  };
}

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
  return base.length > MAX_NICKNAME_LENGTH ? base.slice(0, MAX_NICKNAME_LENGTH) : base;
}

// Modify createPlayer to only store friend IDs
export const createPlayer = functions.runWith({ memory: '512MB' }).auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(user.uid);
  const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const startLeague = League.BRONZE;
  const isAdmin = (process.env.ADMIN_MODE == 'true');
  console.log(`[createPlayer] isAdmin: ${isAdmin}`);

  const bronzePlayersCount = await db.collection("players")
    .where("league", "==", startLeague)
    .count()
    .get();

  const name = generateName();
  // Define the character data structure
  const playerData = {
    name: name,
    name_lower: name.toLowerCase(),
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
    dailyloot: getDefaultDailyLoot(),
    leagueStats: getEmptyLeagueStats(bronzePlayersCount.data().count + 1),
    allTimeStats: getEmptyLeagueStats(-1),
    casualStats: {
      nbGames: 0,
      wins: 0,
    },
    AIstats: {
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
      completedGames: 0, // Total games completed
      totalGames: 0, // Total games started
      completedTutorial: false,
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
    friends: [] as string[],  // Just store the IDs
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


export const getPlayerData = onRequest({
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      // Little hack for graceful warmup
      if (!request.headers.authorization) {
        response.status(200).send({});
        return;
      }
      // Get UID from auth token or query param
      const uid = await getUID(request) || request.query.uid as string;
      if (!uid) {
        response.status(400).send("No player ID provided");
        return;
      }

      const docSnap = await db.collection('players').doc(uid).get();

      if (docSnap.exists) {
        const playerData = docSnap.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
        if (playerData.lastActiveDate !== today) {
          await db.collection("players").doc(uid).update({
            lastActiveDate: today,
          });
          updateDAU(uid);
        }

        // Check if dailyloot exists, if not create it
        if (!playerData.dailyloot) {
          const defaultDailyLoot = getDefaultDailyLoot();
          await db.collection("players").doc(uid).update({
            dailyloot: defaultDailyLoot,
          });
          playerData.dailyloot = defaultDailyLoot;
        }

        // Transform the chest field so that the `time` field becomes
        // a `countdown` field
        playerData.dailyloot = transformDailyLoot(playerData.dailyloot);

        const tours = Object.keys(playerData.tours || {}).filter((tour) => !playerData.tours[tour]);

        // Ensure inventory fields exist and are arrays
        const inventory = playerData.inventory || {};
        const sortedInventory: PlayerInventory = {
          consumables: Array.isArray(inventory.consumables) ? inventory.consumables.sort(numericalSort) : [],
          spells: Array.isArray(inventory.spells) ? inventory.spells.sort(numericalSort) : [],
          equipment: Array.isArray(inventory.equipment) ? inventory.equipment.sort(numericalSort) : [],
        };

        const AIwinRatio = 
          playerData.AIstats && playerData.AIstats.nbGames > 0 ?
            playerData.AIstats.wins / (playerData.AIstats.nbGames + 2) :
            0;

        response.send({
          uid,
          gold: playerData.gold || 0,
          elo: playerData.elo || 100,
          lvl: playerData.lvl || 1,
          name: playerData.name || '',
          teamName: "teamName",
          avatar: playerData.avatar || '1',
          league: playerData.league || 0,
          rank: playerData.leagueStats?.rank || 0,
          wins: playerData.leagueStats?.wins || 0,
          allTimeRank: playerData.allTimeStats?.rank || 0,
          dailyloot: playerData.dailyloot,
          tours,
          inventory: sortedInventory,
          carrying_capacity: playerData.carrying_capacity || BASE_INVENTORY_SIZE,
          isLoaded: false,
          tokens: playerData.tokens || { [Token.SOL]: 0 },
          AIwinRatio,
        } as PlayerContextData);
      } else {
        response.status(404).send(`Player ID ${uid} not found`);
      }
    } catch (error) {
      console.error("playerData error:", error);
      if (error instanceof Error && error.message === "No UID provided") {
        response.status(400).send("No player ID provided");
      } else {
        response.status(401).send("Unauthorized");
      }
    }
  });
});

export const queuingData = onRequest({
  memory: '512MiB'
}, (request, response) => {
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

export const saveGoldReward = onRequest({ 
  secrets: ["API_KEY"],
  memory: '512MiB'
}, (request, response) => {
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

export const claimChest = onRequest({
  memory: '512MiB'
}, (request, response) => {
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

export const completeTour = onRequest({
  memory: '512MiB'
}, (request, response) => {
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

export const fetchGuideTip = onRequest({
  memory: '512MiB'
}, (request, response) => {
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

export const registerAddress = onRequest({
  memory: '512MiB'
}, (request, response) => {
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

export const setPlayerOnSteroids = onRequest({ 
  secrets: ["API_KEY"],
  memory: '512MiB'
}, (request, response) => {
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

export const zombieData = onRequest(
  { 
    secrets: ["API_KEY"], 
    memory: '512MiB' 
  }, 
  async (req, res) => {
  try {
    if (!checkAPIKey(req)) {
      res.status(401).send('Unauthorized');
      return;
    }

    const db = admin.firestore();

    // Get the league and elo parameters from the request
    const league = parseInt(req.query.league as string, 10);
    const targetElo = parseInt(req.query.elo as string, 10);

    console.log(`[zombieData] Fetching zombie data for elo: ${targetElo} and league: ${league}`);

    if (isNaN(league) || isNaN(targetElo)) {
      res.status(400).json({ error: 'Valid league and elo parameters are required' });
      console.log(`[zombieData] Invalid league or elo parameters: ${league} ${targetElo}`);
      return;
    }

    // Calculate date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const cutoffDate = oneWeekAgo.toISOString().replace('T', ' ').slice(0, 19);

    // Prepare the query
    let playersQuery = db.collection('players')
      .where('lastActiveDate', '<', cutoffDate);
    
    if (league !== -1) {
      playersQuery = playersQuery.where('league', '==', league);
    }

    // Get all matching player documents
    const playersSnapshot = await playersQuery.get();
    const playerDocs = playersSnapshot.docs;

    console.log(`[zombieData] Found ${playerDocs.length} inactive players`);

    if (playerDocs.length === 0) {
      res.json({});
      return;
    }

    // Shuffle the array of player documents
    for (let i = playerDocs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerDocs[i], playerDocs[j]] = [playerDocs[j], playerDocs[i]];
    }

    // Select up to 10 random players
    const selectedPlayers = playerDocs.slice(0, 10);

    // Find the player with the closest ELO
    let closestPlayer = null;
    let closestEloDiff = Infinity;

    for (const playerDoc of selectedPlayers) {
      const playerData = playerDoc.data();
      if (playerData) {
        const eloDiff = Math.abs(playerData.elo - targetElo);
        if (eloDiff < closestEloDiff) {
          closestEloDiff = eloDiff;
          closestPlayer = { id: playerDoc.id, data: playerData };
        }
      }
    }

    if (closestPlayer) {
      const { id: playerId, data: playerData } = closestPlayer;

      // Get character data
      const characterRefs = playerData.characters || [];
      const characterDocs = await db.getAll(...characterRefs, {
        fieldMask: ['name', 'portrait', 'level', 'class', 'experience', 'xp', 'sp', 'stats', 
          'carrying_capacity', 'carrying_capacity_bonus', 'skill_slots', 'inventory', 'equipment', 
          'equipment_bonuses', 'sp_bonuses', 'skills',
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
      console.log(`[zombieData] No suitable inactive players found${league !== -1 ? ` in league ${league}` : ''}`);
      res.json({});
    }
  } catch (error) {
    console.error('Error in zombieData:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// export const withdrawSOL = onRequest({ secrets: ["GAME_WALLET_PRIVATE_KEY"] }, async (request, response) => {
//   const db = admin.firestore();

//   return corsMiddleware(request, response, async () => {
//     try {
//       const uid = await getUID(request);
//       const amount = parseFloat(request.body.amount);
//       console.log(`[withdrawSOL] Withdrawing ${amount} SOL for ${uid} on ${RPC}`);

//       if (isNaN(amount) || amount < MIN_WITHDRAW) {
//         return response.status(400).send({ error: `Invalid withdrawal amount. Minimum is ${MIN_WITHDRAW} SOL.` });
//       }

//       const result = await performLockedOperation(uid, async () => {
//         return db.runTransaction(async (transaction) => {
          
//           const playerDocRef = db.collection('players').doc(uid);
//           const playerDoc = await transaction.get(playerDocRef);

//           if (!playerDoc.exists) {
//             throw new Error('Player not found.');
//           }

//           const playerData = playerDoc.data();
//           if (!playerData) {
//             throw new Error('Player data is null.');
//           }

//           const playerAddress = playerData.address;
//           const inGameBalance = playerData.tokens?.[Token.SOL] || 0;

//           if (!playerAddress) {
//             throw new Error('Player wallet address not registered.');
//           }

//           // Check if the player has enough balance
//           if (amount > inGameBalance) {
//             throw new Error('Insufficient in-game balance.');
//           }

//           // Load the game wallet keypair from the environment variable
//           const secretKeyString = process.env.GAME_WALLET_PRIVATE_KEY;
//           if (!secretKeyString) {
//             throw new Error('Game wallet private key not set in environment variables.');
//           }

//           const secretKey = bs58.decode(secretKeyString);
//           const gameWalletKeypair = Keypair.fromSecretKey(secretKey);

//           // Create a connection to the Solana cluster
//           const connection = new Connection(RPC, 'confirmed');

//           // Create a transaction to send SOL from the game wallet to the player
//           const withdrawTransaction = new Transaction().add(
//             SystemProgram.transfer({
//               fromPubkey: gameWalletKeypair.publicKey,
//               toPubkey: new PublicKey(playerAddress),
//               lamports: Math.round(amount * LAMPORTS_PER_SOL),
//             })
//           );

//           // Sign and send the transaction
//           const signature = await connection.sendTransaction(withdrawTransaction, [gameWalletKeypair]);
//           console.log(`Withdrawal transaction signature: ${signature}`);

//           // Wait for transaction confirmation
//           const confirmedTransaction = await fetchParsedTransactionWithRetry(signature, connection);

//           if (!confirmedTransaction) {
//             throw new Error('Transaction could not be confirmed after retries.');
//           }

//           // Update the player's in-game balance
//           transaction.update(playerDocRef, {
//             [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-amount),
//           });

//           // Record the withdrawal transaction
//           const withdrawalRef = db.collection('withdrawals').doc();
//           transaction.set(withdrawalRef, {
//             uid: uid,
//             amount: amount,
//             signature: signature,
//             timestamp: admin.firestore.FieldValue.serverTimestamp(),
//           });

//           return { success: true, signature: signature };
//         });
//       });

//       return response.status(200).send(result);
//     } catch (error) {
//       console.error('withdrawSOL error:', error);
//       if (error instanceof Error && error.message === 'Failed to acquire lock. Resource is busy.') {
//         return response.status(423).send({ error: "Resource is locked. Please try again later." });
//       }
//       return response.status(500).send({ error: 'An error occurred during withdrawal: ' + (error instanceof Error ? error.message : String(error)) });
//     }
//   });
// });

export const recordPlayerAction = onRequest({
  memory: '512MiB'
}, (request, response) => {
  return corsMiddleware(request, response, async () => {
    try {
      console.log(`[recordPlayerAction] ${JSON.stringify(request.body)}`);
      const uid = await getUID(request);
      const actionType = request.body.actionType;
      const details = request.body.details;
      logPlayerAction(uid, actionType, details);

      // Check if action type is pageView and if the message.details are in format "/game/:gameid"
      if (actionType == 'pageView' && details.message.includes('/game/')) {
        await incrementStartedGames(uid);
      }

      if (actionType == 'completedGame') {
        await incrementCompletedGame(uid);
      }

      if (actionType == 'tutorial' && details == 'coda') {
        await incrementCompletedTutorial(uid);
      }

      response.status(200).send({});
    } catch (error) {
      console.error('recordPlayerAction error:', error);
      response.status(500).send('An error occurred during recordPlayerAction: ' + (error instanceof Error ? error.message : String(error)));
    }
  });
});

async function incrementCompletedTutorial(uid: string) {
  const db = admin.firestore();
  await db.collection('players').doc(uid).update({
    'engagementStats.completedTutorial': true,
  });
}

async function incrementStartedGames(uid: string) {
  const db = admin.firestore();
  await db.collection('players').doc(uid).set({
    engagementStats: {
      totalGames: admin.firestore.FieldValue.increment(1)
    }
  }, { merge: true });
}

async function incrementCompletedGame(uid: string) {
  const db = admin.firestore();
  await db.collection('players').doc(uid).set({
    engagementStats: {
      completedGames: admin.firestore.FieldValue.increment(1)
    }
  }, { merge: true });
}

export const updateInactivePlayersStats = onSchedule(
  {
    schedule: "every day 00:00",
    memory: "512MiB",
  }, 
  async (event) => {
  const db = admin.firestore();
  const now = new Date();
  
  // Calculate the timestamp for 48 hours ago
  const cutoffDate = new Date(now.getTime() - (48 * 60 * 60 * 1000));
  const cutoffDateString = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);

  try {
    const snapshot = await db.collection("players")
      .where("lastActiveDate", "<", cutoffDateString)
      .where("leagueStats.wins", "==", 0)
      .where("leagueStats.losses", "==", 0)
      .get();

    const batch = db.batch();
    let updatedCount = 0;

    snapshot.forEach(doc => {
      // Generate total games using exponential distribution for more variation
      const lambda = 0.1; // Parameter for exponential distribution
      const randomGames = Math.round(-Math.log(1 - Math.random()) / lambda);
      const cappedGames = Math.min(Math.max(randomGames, 1), 50); // Cap between 1 and 50 games
      
      // Generate win ratio using beta distribution for more natural variation
      // Beta distribution parameters (can be adjusted)
      const alpha = 2;
      const beta = 2;
      
      // Approximate beta distribution using normal distribution
      let u1 = Math.random();
      let u2 = Math.random();
      let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      // Transform to beta-like distribution centered around 0.45
      let winRatio = 0.45 + (z0 * 0.15); // Standard deviation of 0.15
      winRatio = Math.max(0.1, Math.min(0.8, winRatio)); // Clamp between 0.1 and 0.8
      
      const wins = Math.round(cappedGames * winRatio);
      const losses = cappedGames - wins;
      
      // More dramatic ELO adjustments based on performance
      const winRateDeviation = winRatio - 0.45; // Deviation from expected 0.45
      const eloAdjustment = Math.round(winRateDeviation * 100); // Scale factor of 50
      
      const currentElo = doc.data()?.elo || 100;
      const newElo = currentElo + eloAdjustment;
      
      batch.update(doc.ref, {
        'leagueStats.wins': wins,
        'leagueStats.losses': losses,
        'leagueStats.nbGames': cappedGames,
        elo: newElo
      });
      
      updatedCount++;
    });

    if (updatedCount > 0) {
      await batch.commit();
      logger.info(`Updated ${updatedCount} inactive players' stats with synthetic games`);
    } else {
      logger.info("No inactive players found needing updates");
    }
  } catch (error) {
    logger.error("Error updating inactive players:", error);
    throw error;
  }
});

export const setUtmSource = onRequest({
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const utmSource = request.body.utmSource;
      logger.info("Setting UTM source for player:", uid, "utmSource:", utmSource);

      await db.collection("players").doc(uid).set({
        acquisition: {
          utmSource,
        }
      }, { merge: true });

      response.send({ success: true });
    } catch (error) {
      console.error("setUtmSource error:", error);
      response.status(500).send("Error");
    }
  });
});

// Update the getProfileData function to include name and avatar in the response
export const getProfileData = onRequest({
  memory: '512MiB'
}, (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const playerId = request.query.playerId as string;
            if (!playerId) {
                response.status(400).send('Player ID is required');
                return;
            }

            const playerDoc = await db.collection('players').doc(playerId).get();
            
            if (!playerDoc.exists) {
                response.status(404).send('Player not found');
                return;
            }

            const playerData = playerDoc.data();
            const allTimeStats = playerData?.allTimeStats;
            const casualStats = playerData?.casualStats;
            const leagueStats = playerData?.leagueStats;

            const profileData = {
                name: playerData?.name || '',
                avatar: playerData?.avatar || '',
                allTimeStats: {
                    losses: allTimeStats?.losses || 0,
                    lossStreak: allTimeStats?.lossesStreak || 0,
                    wins: allTimeStats?.wins || 0,
                    winStreak: allTimeStats?.winStreak || 0,
                    nbGames: allTimeStats?.nbGames || 0,
                    rank: allTimeStats?.rank || 0,
                },
                casualStats: {
                    gamesPlayed: casualStats?.nbGames || 0,
                    wins: casualStats?.wins || 0
                },
                elo: playerData?.elo || 1000,
                joinDate: playerData?.joinDate || '',
                league: playerData?.league || 0,
                leagueStats: {
                    gamesPlayed: leagueStats?.nbGames || 0,
                    wins: leagueStats?.wins || 0,
                    losses: leagueStats?.losses || 0,
                    lossStreak: leagueStats?.lossesStreak || 0,
                    winStreak: leagueStats?.winStreak || 0,
                    rank: leagueStats?.rank || 0,
                    league: playerData?.league || 0,
                }
            };

            response.send(profileData);

        } catch (error) {
            console.error('Error fetching profile data:', error);
            response.status(500).send('Error fetching profile data');
        }
    });
});

// Add this interface at the top with other interfaces
interface PlayerSearchResult {
    id: string;
    name: string;
    avatar: string;
}

// Update the searchPlayers endpoint to use name_lower field
export const searchPlayers = onRequest({
  memory: '512MiB'
}, (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const searchTerm = request.query.search as string;
            if (!searchTerm) {
                response.status(400).send('Search term is required');
                return;
            }

            const searchTermLower = searchTerm.toLowerCase();
            const querySnapshot = await db.collection('players')
                .where('name_lower', '>=', searchTermLower)
                .where('name_lower', '<=', searchTermLower + '\uf8ff')
                .limit(10)
                .get();

            const results: PlayerSearchResult[] = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    name: data.name,
                    avatar: data.avatar
                });
            });

            response.send(results);

        } catch (error) {
            console.error('Error searching players:', error);
            response.status(500).send('Error searching players');
        }
    });
});

// Add migration endpoint to add name_lower field
export const migrateLowercaseNames = onRequest({ 
  secrets: ["API_KEY"],
  memory: '512MiB'
}, (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            if (!checkAPIKey(request)) {
                response.status(401).send('Unauthorized');
                return;
            }

            const snapshot = await db.collection('players').get();
            const batch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.name && !data.name_lower) {
                    batch.update(doc.ref, {
                        name_lower: data.name.toLowerCase()
                    });
                    count++;
                }
            });

            await batch.commit();
            response.send({ message: `Updated ${count} documents` });

        } catch (error) {
            console.error('Error in migration:', error);
            response.status(500).send('Error performing migration');
        }
    });
});

// Add new endpoint for listing friends
export const listFriends = onRequest({
  memory: '512MiB'
}, (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const playerId = request.query.playerId as string;
            if (!playerId) {
                response.status(400).send('Player ID is required');
                return;
            }

            const playerDoc = await db.collection('players').doc(playerId).get();
            if (!playerDoc.exists) {
                response.status(404).send('Player not found');
                return;
            }

            const playerData = playerDoc.data();
            if (!playerData) {
                response.status(404).send('Player not found');
                return;
            }

            const friendIds = playerData.friends || [] as string[];

            // Fetch friend details in parallel
            const friendDocs = await Promise.all(
                friendIds.map((friendId: string) => 
                    db.collection('players').doc(friendId).get()
                )
            );

            const friends = friendDocs
                .filter(doc => doc.exists)
                .map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    avatar: doc.data().avatar
                }));

            response.send(friends);

        } catch (error) {
            console.error('Error listing friends:', error);
            response.status(500).send('Error listing friends');
        }
    });
});

// Update addFriend endpoint to handle missing friends field
export const addFriend = onRequest({
  memory: '512MiB'
}, (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const friendId = request.body.friendId;

            if (!friendId) {
                response.status(400).send('Friend ID is required');
                return;
            }

            // Prevent adding self as friend
            if (uid === friendId) {
                response.status(400).send('Cannot add yourself as a friend');
                return;
            }

            // Get both player documents
            const [playerDoc, friendDoc] = await Promise.all([
                db.collection('players').doc(uid).get(),
                db.collection('players').doc(friendId).get()
            ]);

            if (!playerDoc.exists || !friendDoc.exists) {
                response.status(404).send('Player or friend not found');
                return;
            }

            const playerData = playerDoc.data();

            if (!playerData) {
                response.status(404).send('Player not found');
                return;
            }

            // Check if already friends, safely handling the case where friends field might not exist
            const currentFriends = playerData.friends || [];
            if (currentFriends.includes(friendId)) {
                response.status(400).send('Already friends');
                return;
            }

            const friendData = friendDoc.data();
            if (!friendData) {
                response.status(404).send('Friend not found');
                return;
            }

            // Add friend ID to player's friends list, creating the array if it doesn't exist
            await db.collection('players').doc(uid).set({
                friends: admin.firestore.FieldValue.arrayUnion(friendId)
            }, { merge: true });  // Use merge: true to not overwrite other fields

            response.send({
                success: true,
                friend: {
                    id: friendId,
                    name: friendData.name,
                    avatar: friendData.avatar
                }
            });

        } catch (error) {
            console.error('Error adding friend:', error);
            response.status(500).send('Error adding friend');
        }
    });
});

// Update the function declaration to include memory configuration
export const updatePlayerName = onRequest({ 
  memory: '512MiB' 
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      let newName = request.body.name;

      // Validate name
      if (!newName || typeof newName !== 'string') {
        response.status(400).send('Valid name is required');
        return;
      }

      if (newName.length > MAX_NICKNAME_LENGTH) {
        response.status(400).send(`Name must be ${MAX_NICKNAME_LENGTH} characters or less`);
        return;
      }

      // Dynamically import the profanity filter
      const { RegExpMatcher } = await import('obscenity');
      const { englishDataset } = await import('obscenity');
      const { englishRecommendedTransformers } = await import('obscenity');

      const matcher = new RegExpMatcher({
        ...englishDataset.build(),
        ...englishRecommendedTransformers,
      });
      const matches = matcher.getAllMatches(newName);
      if (matches.length > 0) {
        response.status(400).send('Name contains profane words');
        return;
      }

      // Update both name and name_lower
      await db.collection('players').doc(uid).update({
        name: newName,
        name_lower: newName.toLowerCase()
      });

      response.send({
        success: true,
        name: newName
      });

    } catch (error) {
      console.error('Error updating player name:', error);
      response.status(500).send('Error updating player name');
    }
  });
});

export const updatePlayerAvatar = onRequest({
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const avatarId = request.body.avatarId;

      // Validate avatar ID
      if (!avatarId) {
        response.status(400).send('Valid avatar ID is required');
        return;
      }

      // Convert to number and validate range
      const numericAvatarId = parseInt(avatarId, 10);
      if (isNaN(numericAvatarId) || 
          numericAvatarId < 1 || 
          numericAvatarId > MAX_AVATAR_ID) {
        response.status(400).send(`Avatar ID must be between 1 and ${MAX_AVATAR_ID}`);
        return;
      }

      // Update avatar
      await db.collection('players').doc(uid).update({
        avatar: avatarId
      });

      response.send({
        success: true,
        avatar: avatarId
      });

    } catch (error) {
      console.error('Error updating player avatar:', error);
      response.status(500).send('Error updating player avatar');
    }
  });
});