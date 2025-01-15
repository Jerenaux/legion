import {Transaction} from "firebase-admin/firestore";

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {checkAPIKey, corsMiddleware, getUID} from "./APIsetup";
import {getMaxStatValue, getSPIncrement} from "@legion/shared/levelling";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Class, statFieldsByIndex, PlayMode, Stat} from "@legion/shared/enums";
import {MAX_CHARACTERS} from "@legion/shared/config";
import {OutcomeData, DailyLootAllDBData, CharacterUpdate, DBCharacterData} from "@legion/shared/interfaces";
import {ChestReward} from "@legion/shared/chests";
import {logPlayerAction} from "./dashboardAPI";
import { canIncreaseStat } from "@legion/shared/inventory";

export const rosterData = onRequest({
  memory: '512MiB'
}, async (request, response) => {
  const db = admin.firestore();
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const characters = docSnap.data()?.characters as admin.firestore.DocumentReference[];

        // Batch get operation
        const characterDocs = await db.getAll(...characters, {
          fieldMask: ['name', 'portrait', 'level', 'class', 'experience', 'xp', 'sp', 'stats', 'carrying_capacity',
            'carrying_capacity_bonus', 'skill_slots', 'inventory', 'equipment', 'equipment_bonuses', 'sp_bonuses',
            'skills',
          ],
        });

        const rosterData = characterDocs.map((characterDoc) => {
          return {
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
          };
        });

        response.send({
          characters: rosterData,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("rosterData error:", error);
      response.status(500).send(error);
    }
  });
});

export const characterData = onRequest({
  memory: '512MiB'
}, (request, response) => {
  logger.info("Fetching characterData");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);

      // Check that character is owned by player
      const playerDoc = await db.collection("players").doc(uid).get();
      const characters =
          playerDoc.data()?.characters as admin.firestore.DocumentReference[];
      const characterIds = characters.map((character) => character.id);
      if (!characterIds.includes(request.query.id as string)) {
        response.status(404).send("Not Found: character not owned by player");
      }

      if (!request.query.id) {
        response.status(404).send("Not Found: Invalid character ID");
      }
      const docSnap =
          await db.collection("characters")
            .doc(request.query.id as string).get();

      if (docSnap.exists) {
        const characterData = docSnap.data();
        response.send({
          ...characterData,
        });
      } else {
        response.status(404).send("Not Found: Invalid character ID");
      }
    } catch (error) {
      console.error("characterData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export async function processChestRewards(
  transaction: Transaction,
  playerRef: admin.firestore.DocumentReference,
  content: ChestReward[],
  consumables: number[],
  spells: number[],
  equipment: number[]
) {
  // logger.info(`Processing chest rewards for player ${playerRef.id}: ${JSON.stringify(content)}`);
  content.forEach((reward: ChestReward) => {
    if (reward.type === "gold") {
      transaction.update(playerRef, {
        gold: admin.firestore.FieldValue.increment(reward.amount || 0),
      });
    } else if (reward.type == "consumable") {
      consumables.push(reward.id);
      transaction.update(playerRef, {
        "inventory.consumables": consumables,
      });
    } else if (reward.type == "spell") {
      spells.push(reward.id);
      transaction.update(playerRef, {
        "inventory.spells": spells,
      });
    } else if (reward.type == "equipment") {
      equipment.push(reward.id);
      transaction.update(playerRef, {
        "inventory.equipment": equipment,
      });
    }
  });
}

export const postGameUpdate = onRequest({ 
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
      const uid = request.body.uid;
      const {isWinner, xp, gold, characters, elo, key, chests, rawGrade, score, tokens} =
        request.body.outcomes as OutcomeData;
      const {spellsUsed, itemsUsed, movements, attacks, flames, ice, poison, silenced, paralyzed, lowMP} =
        request.body.engagement as any;
      console.log(
        `[postGameUpdate] Spells used: ${spellsUsed}, Items used: ${itemsUsed}, Movements: ${movements}, Attacks: ${attacks}, Flames: ${flames}, Ice: ${ice}, Poison: ${poison}, Silenced: ${silenced}, Paralyzed: ${paralyzed}`);
      const mode = request.body.mode as PlayMode;

      if (!uid || typeof uid !== 'string' || uid.trim() === '') {
        throw new Error('Invalid or missing uid');
      }

      logPlayerAction(uid, "reward", {xp, gold, key, chests, elo});

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          throw new Error("Player document does not exist");
        }

        const playerData = playerDoc.data();

        if (!playerData) {
          throw new Error("Player data does not exist");
        }

        const dailyLoot = playerData.dailyloot as DailyLootAllDBData;
        if (key) {
          dailyLoot[key].hasKey = true;
        }

        const inventory = playerData.inventory || {};
        const consumables = inventory.consumables || [];
        const spells = inventory.spells || [];
        const equipment = inventory.equipment || [];

        const contents = chests.map((chest) => chest.content).flat();
        await processChestRewards(transaction, playerRef, contents, consumables, spells, equipment);

        transaction.update(playerRef, {
          xp: admin.firestore.FieldValue.increment(xp || 0),
          gold: admin.firestore.FieldValue.increment(gold || 0),
          elo: admin.firestore.FieldValue.increment(elo || 0),
          dailyloot: dailyLoot,
        });

        if (tokens) {
          transaction.update(playerRef, {
            'tokens.SOL': admin.firestore.FieldValue.increment(tokens || 0),
          });
        }

        if (spellsUsed) {
          transaction.update(playerRef, {
            'engagementStats.everUsedSpell': true,
          });
        }

        if (itemsUsed) {
          transaction.update(playerRef, {
            'engagementStats.everUsedItems': true,
          });
        }

        if (movements) {
          transaction.update(playerRef, {
            'engagementStats.everMoved': true,
          });
        }

        if (attacks) {
          transaction.update(playerRef, {
            'engagementStats.everAttacked': true,
          });
        }

        if (flames) {
          transaction.update(playerRef, {
            'engagementStats.everSawFlames': true,
          });
        }

        if (ice) {
          transaction.update(playerRef, {
            'engagementStats.everSawIce': true,
          });
        }

        if (poison) {
          transaction.update(playerRef, {
            'engagementStats.everPoisoned': true,
          });
        }

        if (silenced) {
          transaction.update(playerRef, {
            'engagementStats.everSilenced': true,
          });
        }

        if (paralyzed) {
          transaction.update(playerRef, {
            'engagementStats.everParalyzed': true,
          });
        }

        if (lowMP) {
          transaction.update(playerRef, {
            'engagementStats.everLowMP': true,
          });
        }

        if (mode == PlayMode.PRACTICE) {
          transaction.update(playerRef, {
            'engagementStats.everPlayedPractice': true,
          });
        } else if (mode == PlayMode.CASUAL || mode == PlayMode.CASUAL_VS_AI) {
          transaction.update(playerRef, {
            'engagementStats.everPlayedCasual': true,
          });
        } else if (mode == PlayMode.RANKED || mode == PlayMode.RANKED_VS_AI) {
          transaction.update(playerRef, {
            'engagementStats.everPlayedRanked': true,
          });
        }

        if (mode != PlayMode.PRACTICE) {
          if (isWinner) {
              transaction.update(playerRef, {
                lossesStreak: 0,
              });
          } else {
              transaction.update(playerRef, {
                lossesStreak: admin.firestore.FieldValue.increment(1),
              });
          }

          if (mode == PlayMode.CASUAL || mode == PlayMode.CASUAL_VS_AI) {
            transaction.update(playerRef, {
              'casualStats.nbGames': admin.firestore.FieldValue.increment(1),
            });
            if (isWinner) {
              transaction.update(playerRef, {
                'casualStats.wins': admin.firestore.FieldValue.increment(1),
              });
            }
          }

          if (mode == PlayMode.RANKED || mode == PlayMode.RANKED_VS_AI) {
            console.log(`[postGameUpdate for player ${uid}] Updating ranked stats`);
            if (isWinner) {
              console.log(`[postGameUpdate for player ${uid}] Updating ranked stats: wins`);
              transaction.update(playerRef, {
                'leagueStats.wins': admin.firestore.FieldValue.increment(1),
                'allTimeStats.wins': admin.firestore.FieldValue.increment(1),
                'leagueStats.winStreak': admin.firestore.FieldValue.increment(1),
                'allTimeStats.winStreak': admin.firestore.FieldValue.increment(1),
                'leagueStats.lossesStreak': 0,
                'allTimeStats.lossesStreak': 0,
              });
            } else {
              console.log(`[postGameUpdate for player ${uid}] Updating ranked stats: losses`);
              transaction.update(playerRef, {
                'leagueStats.losses': admin.firestore.FieldValue.increment(1),
                'allTimeStats.losses': admin.firestore.FieldValue.increment(1),
                'leagueStats.winStreak': 0,
                'allTimeStats.winStreak': 0,
                'leagueStats.lossesStreak': admin.firestore.FieldValue.increment(1),
                'allTimeStats.lossesStreak': admin.firestore.FieldValue.increment(1),
              });
            }
            let leagueAvgAudienceScore = playerData.leagueStats?.avgAudienceScore || 0;
            let allTimeAvgAudienceScore = playerData.allTimeStats?.avgAudienceScore || 0;
            let leagueAvgGrade = playerData.leagueStats?.avgGrade || 0;
            let allTimeAvgGrade = playerData.allTimeStats?.avgGrade || 0;
            const leagueNbGames = playerData.leagueStats?.nbGames || 0;
            const allTimeNbGames = playerData.allTimeStats?.nbGames || 0;
            leagueAvgAudienceScore = (leagueAvgAudienceScore * leagueNbGames + score) / (leagueNbGames + 1);
            allTimeAvgAudienceScore = (allTimeAvgAudienceScore * allTimeNbGames + score) / (allTimeNbGames + 1);
            leagueAvgGrade = (leagueAvgGrade * leagueNbGames + rawGrade) / (leagueNbGames + 1);
            allTimeAvgGrade = (allTimeAvgGrade * allTimeNbGames + rawGrade) / (allTimeNbGames + 1);
            transaction.update(playerRef, {
              'leagueStats.nbGames': admin.firestore.FieldValue.increment(1),
              'allTimeStats.nbGames': admin.firestore.FieldValue.increment(1),
              'leagueStats.avgAudienceScore': leagueAvgAudienceScore,
              'allTimeStats.avgAudienceScore': allTimeAvgAudienceScore,
              'leagueStats.avgGrade': leagueAvgGrade,
              'allTimeStats.avgGrade': allTimeAvgGrade,
            });
          }
        }

        if (mode == PlayMode.PRACTICE || mode == PlayMode.CASUAL_VS_AI || mode == PlayMode.RANKED_VS_AI) {
          // First ensure AIstats exists with default values if needed
          const currentAIStats = playerData.AIstats || { nbGames: 0, wins: 0 };
          
          // Then perform the updates
          transaction.update(playerRef, {
            AIstats: {
              nbGames: currentAIStats.nbGames + 1,
              wins: currentAIStats.wins + (isWinner ? 1 : 0)
            }
          });
        }

        // Iterate over the player's characters and increase their XP
        // Update XP for each character directly using their references
        if (playerData.characters && Array.isArray(playerData.characters) && characters) {
          for (const characterRef of playerData.characters) {
            if (characterRef instanceof admin.firestore.DocumentReference) {
              // Find the corresponding CharacterRewards object
              const characterRewards =
                characters.find((c: CharacterUpdate) => c.id === characterRef.id);

              if (characterRewards) {
                const sp = characterRewards.points;
                transaction.update(characterRef, {
                  xp: characterRewards.xp,
                  level: admin.firestore.FieldValue.increment(characterRewards.level),
                  sp: admin.firestore.FieldValue.increment(sp),
                  allTimeSP: admin.firestore.FieldValue.increment(sp),
                });
              } else {
                console.error(`No matching CharacterRewards found for ${characterRef.id}`);
              }
            } else {
              console.error(`Invalid character reference ${characterRef}`);
            }
          }
        }
      });
      response.send({status: 0});
    } catch (error) {
      console.error("Error processing reward:", error);
      response.status(500).send("Error: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  });
});

async function createCharacterForSale(
  db: FirebaseFirestore.Firestore,
  classType: Class = Class.RANDOM
) {
  // const level = 1; // Math.floor(Math.random() * 100);
  const character = new NewCharacter(classType, 1, true).getCharacterData(true);
  character.onSale = true;
  // Add the character to the collection
  await db.collection("characters").add(character);
}

async function monitorCharactersOnSale(db: FirebaseFirestore.Firestore) {
  const querySnapshot = await db.collection("characters")
    .where("onSale", "==", true)
    .get();
  let onSaleCount = querySnapshot.size;
  const TARGET_COUNT = 10 + Math.floor(Math.random() * 4) - 2;
  // Check that the list of on sale characters contains at least one
  // character of each class
  const classCounts = new Array(3).fill(0);
  querySnapshot.docs.forEach((doc: any) => {
    const characterData = doc.data();
    classCounts[characterData.class]++;
  });

  // Create characters for sale if necessary
  for (let i = 0; i < classCounts.length; i++) {
    if (classCounts[i] === 0) {
      await createCharacterForSale(db, i);
      onSaleCount++;
    }
  }

  while (onSaleCount < TARGET_COUNT) {
    await createCharacterForSale(db);
    onSaleCount++;
  }
}

export const generateOnSaleCharacters = onRequest({
  memory: '512MiB'
}, (request, response) => {
  logger.info("Generating on sale characters");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      // Count how many characters have the `onSale` flag set to true
      // in the collection
      const delta = 0;
      monitorCharactersOnSale(db);
      response.send({delta});
    } catch (error) {
      console.error("Error generating on sale characters:", error);
      response.status(500).send("Errir");
    }
  });
});

export const listOnSaleCharacters = onRequest({
  memory: '512MiB'
}, (request, response) => {
  logger.info("Listing on sale characters");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      let querySnapshot = await db.collection("characters")
        .where("onSale", "==", true)
        .get();

      // If there are no on sale characters, populate the database with on sale characters
      if (querySnapshot.empty) {
        await monitorCharactersOnSale(db);

        // Fetch the updated list of on sale characters
        querySnapshot = await db.collection("characters")
          .where("onSale", "==", true)
          .get();
      }

      const characters = querySnapshot.docs.map((doc) => {
        const characterData = doc.data();
        return {
          id: doc.id, // Include the document ID
          ...characterData,
        };
      });

      response.send(characters);
    } catch (error) {
      console.error("Error listing on sale characters:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const deleteOnSaleCharacters = onRequest({
  memory: '512MiB'
}, (request, response) => {
  logger.info("Deleting on sale characters");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const querySnapshot = await db.collection("characters")
        .where("onSale", "==", true)
        .get();
      const batch = db.batch();
      querySnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      response.send({status: 0});
    } catch (error) {
      console.error("Error deleting on sale characters:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const purchaseCharacter = onRequest({
  memory: '512MiB'
}, (request, response) => {
  logger.info("Purchasing character");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.articleId;

      if (!characterId) {
        throw new Error("Character ID is not provided or is invalid.");
      }

      // Fetch the price of the character
      const characterDoc = await db.collection("characters")
        .doc(characterId).get();
      const characterData = characterDoc.data();
      if (!characterData) {
        throw new Error("Character does not exist");
      }
      if (!characterData.onSale) {
        throw new Error("Character is not on sale");
      }
      const price = characterData.price;

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          throw new Error("Documents do not exist");
        }

        const playerData = playerDoc.data();

        if (!playerData) {
          throw new Error("Data does not exist");
        }

        // Check that player has enough gold to purchase character
        if (playerData.gold < price) {
          throw new Error("Player does not have enough gold");
        }

        // Check if player has less than MAX_CHARACTERS characters
        if (playerData.characters.length >= MAX_CHARACTERS) {
          throw new Error("Player has too many characters");
        }

        // Subtract gold from player
        transaction.update(playerRef, {
          gold: admin.firestore.FieldValue.increment(-price),
        });

        // Add character to player's roster
        transaction.update(playerRef, {
          characters: admin.firestore.FieldValue.arrayUnion(
            db.collection("characters").doc(characterId)
          ),
        });

        transaction.update(db.collection("characters").doc(characterId), {
          onSale: false,
          price: 0,
        });
      });
      console.log("Transaction successfully committed!");
      logPlayerAction(uid, "purchaseCharacter", {characterId, price});
      monitorCharactersOnSale(db);

      response.send({status: 0});
    } catch (error) {
      console.error("Error purchasing character:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const spendSP = onRequest({
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const amount = request.body.amount;
      const index = request.body.stat as number;
      let stat;
      console.log(`[spendSP] Spending ${amount} SP on stat [${index} ] ${statFieldsByIndex[index]}`);

      if (index < 0 || index >= statFieldsByIndex.length) {
        throw new Error("Invalid stat index");
      }

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const characterRef = db.collection("characters").doc(characterId);

        const playerDoc = await transaction.get(playerRef);
        const characterDoc = await transaction.get(characterRef);

        if (!playerDoc.exists || !characterDoc.exists) {
          throw new Error("Documents do not exist");
        }

        const playerData = playerDoc.data();
        const characterData = characterDoc.data() as DBCharacterData;

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        // Check that character is owned by player
        const characters = playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new Error("Character not owned by player");
        }

        // Check that character has enough skill points
        if (characterData.sp < amount) {
          throw new Error("Character does not have enough skill points");
        }

        // Check if new value would exceed maximum
        if (!canIncreaseStat(characterData, index, amount)) {
          throw new Error(`Cannot exceed maximum value of ${getMaxStatValue(index as Stat)} for ${statFieldsByIndex[index]}`);
        }
        const spBonuses = characterData.sp_bonuses;
        spBonuses[statFieldsByIndex[index]] += getSPIncrement(index) * amount;

        transaction.update(characterRef, {
          sp: admin.firestore.FieldValue.increment(-amount),
          sp_bonuses: spBonuses,
        });

        transaction.update(playerRef, {
          'engagementStats.everSpentSP': true,
        });
      });

      logPlayerAction(uid, "spendSP", {characterId, amount, stat});

      response.send({status: 0});
    } catch (error) {
      console.error("Error spending skill points:", error);
      response.status(500).send("Error");
    }
  });
});

