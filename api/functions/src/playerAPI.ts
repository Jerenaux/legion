import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, {corsMiddleware, getUID} from "./APIsetup";

import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

import {Class, ChestColor, League} from "@legion/shared/enums";
import {APIPlayerData, DailyLootAllDBData, DailyLootAllAPIData, DBPlayerData} from "@legion/shared/interfaces";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {getChestContent, ChestReward} from "@legion/shared/chests";
import {processChestRewards} from "./characterAPI";
import {STARTING_CONSUMABLES, STARTING_GOLD, BASE_INVENTORY_SIZE, STARTING_GOLD_ADMIN, STARTING_SPELLS_ADMIN, STARTING_EQUIPMENT_ADMIN} from "@legion/shared/config";
import {logPlayerAction, updateDAU} from "./dashboardAPI";

const NB_START_CHARACTERS = 3;

const chestsDelays = {
  [ChestColor.BRONZE]: 6*60*60,
  [ChestColor.SILVER]: 12*60*60,
  [ChestColor.GOLD]: 24*60*60,
};

function selectRandomAvatar(): string {
  // Return a random value betweem 1 and 31 included
  return (Math.floor(Math.random() * 31) + 1).toString();
}

function generateName() {
  // limit names to length of 16 characters
  const options = {
    dictionaries: [adjectives, colors, animals],
    length: 2,
    separator: " ",
    style: "capital",
  };
  // @ts-ignore
  const base = uniqueNamesGenerator(options);
  return base.length > 16 ? base.slice(0, 16) : base;
}

export const createPlayer = functions.auth.user().onCreate(async (user) => {
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
    leagueStats: {
      rank: bronzePlayersCount.data().count + 1,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossesStreak: 0,
      nbGames: 0,
      avgAudienceScore: 0,
      avgGrade: 0,
    },
    allTimeStats: {
      rank: -1,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossesStreak: 0,
      nbGames: 0,
      avgAudienceScore: 0,
      avgGrade: 0,
    },
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
    utilizationStats: {
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
      return new Promise((resolve) => setTimeout(resolve, 250));
    })
    .then(() => {
      logger.info("Delay completed, function finishing for user:", user.uid);
    })
    .catch((error) => {
      logger.info("Error creating player and characters:", error);
    });
});

const transformDailyLoot = (dailyloot: DailyLootAllDBData): DailyLootAllAPIData => {
  const now = Date.now() / 1000;
  const transformedChests: DailyLootAllAPIData = {
    [ChestColor.BRONZE]: {hasKey: false, countdown: 0},
    [ChestColor.SILVER]: {hasKey: false, countdown: 0},
    [ChestColor.GOLD]: {hasKey: false, countdown: 0},
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
      const docSnap = await db.collection("players").doc(uid).get();

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
        } as APIPlayerData);
      } else {
        response.status(404).send("Not Found: Invalid player ID");
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

export const saveGoldReward = onRequest((request, response) => {
  logger.info("Saving gold reward");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
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

export const claimChest = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const chestType = request.query.chestType;
      logger.info("Claiming chest for player:", uid, "chestType:", chestType);

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

        const chest = playerData.dailyloot[chestType as keyof DailyLootAllDBData];
        if (!chest) {
          throw new Error("Invalid chest type");
        }

        const now = Date.now() / 1000;
        if (!chest.hasKey) {
          response.status(400).send("Key for chest not owned!");
          return;
        }
        if (chest.time > now) {
          response.status(400).send("Chest is still locked!");
          return;
        }

        playerData.dailyloot[chestType as keyof DailyLootAllDBData] = {
          time: now + chestsDelays[chestType as keyof DailyLootAllDBData],
          hasKey: false,
        };

        transaction.update(playerRef, {
          dailyloot: playerData.dailyloot,
        });

        transaction.update(playerRef, {
          'utilizationStats.everOpenedDailyLoot': true,
        });

        const content: ChestReward[] = getChestContent(chestType as ChestColor);
        logger.info(`Chest content: ${JSON.stringify(content)}`);

        const inventory = playerDoc.data()?.inventory || {};
        const consumables = inventory.consumables || [];
        const spells = inventory.spells || [];
        const equipment = inventory.equipment || [];

        await processChestRewards(transaction, playerRef, content, consumables, spells, equipment);

        const dailyLootResponse = transformDailyLoot(playerData.dailyloot);
        logPlayerAction(uid, "claimChest", {chestType});
        response.send({
          content,
          dailyloot: dailyLootResponse,
        });
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
  !playerData.utilizationStats.everPurchased) {
    return {
      guideId: 0,
      route: "/shop",
    };
  }

  if (!playerData.guideTipsShown.includes(1) && !playerData.utilizationStats.everSpentSP) {
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

  if (!playerData.guideTipsShown.includes(2) && !playerData.utilizationStats.everOpenedDailyLoot) {
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
  !playerData.utilizationStats.everEquippedEquipment) {
    return {
      guideId: 3,
      route: "/team",
    };
  }

  // "You have unused consumables in your inventory! Click here to go to the team page and equip them on your characters!",
  if (!playerData.guideTipsShown.includes(4) &&
  playerData.inventory.consumables.length > 3 &&
  !playerData.utilizationStats.everEquippedConsumable) {
    return {
      guideId: 4,
      route: "/team",
    };
  }

  // "You have unused spells in your inventory! Click here to go to the team page and teach them to your characters!",
  if (!playerData.guideTipsShown.includes(5) &&
  playerData.inventory.spells.length > 0 &&
  !playerData.utilizationStats.everEquippedSpell) {
    return {
      guideId: 5,
      route: "/team",
    };
  }

  // "Not sure what to do? Just click here to start a Practice game and try out your characters and spells!",
  if (!playerData.guideTipsShown.includes(6) &&
  !playerData.utilizationStats.everPlayedPractice) {
    return {
      guideId: 6,
      route: "/queue/0",
    };
  }

  // "Now that you know the game a bit more, click here to play against another player in Casual mode!",
  if (!playerData.guideTipsShown.includes(7) &&
  playerData.utilizationStats.everPlayedPractice &&
  !playerData.utilizationStats.everPlayedCasual) {
    return {
      guideId: 7,
      route: "/queue/1",
    };
  }

  // "You've had a few victories now, why don't you try your luck in Ranked mode and climb the ladder? Click here to start!",
  if (!playerData.guideTipsShown.includes(8) &&
  playerData.casualStats.wins >= 2 &&
  !playerData.utilizationStats.everPlayedRanked) {
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
  (playerData.utilizationStats.everPlayedPractice || playerData.utilizationStats.everPlayedCasual || playerData.utilizationStats.everPlayedRanked) &&
  !playerData.utilizationStats.everUsedSpell) {
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
