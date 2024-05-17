import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {getSPIncrement} from "@legion/shared/levelling";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Class, EquipmentSlot, statFields} from "@legion/shared/enums";
import {OutcomeData, ChestsTimeData} from "@legion/shared/interfaces";
import {ChestReward} from "@legion/shared/chests";

export const rosterData = onRequest((request, response) => {
  logger.info("Fetching rosterData");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const characters =
            docSnap.data()?.characters as admin.firestore.DocumentReference[];
        const characterDocs = await Promise.all(
          characters.map((character) => character.get())
        );
        const rosterData = characterDocs.map(
          (characterDoc) => {
            const characterData = characterDoc.data();
            return {
              id: characterDoc.id, // Include the document ID
              ...characterData,
            };
          }
        );
        response.send({
          characters: rosterData,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("rosterData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const characterData = onRequest((request, response) => {
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

export const rewardsUpdate = onRequest((request, response) => {
  logger.info("Updating rewards");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const {isWinner, xp, gold, characters, elo, keys, chests} =
        request.body as OutcomeData;

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

        // Type guard to check if a key is a valid key of ChestsTimeData
        function isKeyOfChestTimeData(key: any): key is keyof ChestsTimeData {
          return ["bronze", "silver", "gold"].includes(key);
        }

        const chestsData = playerData.chests as ChestsTimeData;
        if (keys) {
          for (const [chestColor, hasObtainedKey]
            of Object.entries(keys)) {
            if (hasObtainedKey && isKeyOfChestTimeData(chestColor) &&
            chestsData[chestColor].hasKey === false) {
              chestsData[chestColor].hasKey = true;
            }
          }
        }

        const inventory = playerDoc.data()?.inventory || {};
        const consumables = inventory.consumables || [];
        const spells = inventory.spells || [];
        const equipment = inventory.equipment || [];

        chests.forEach((chest: any) => {
          chest.content.forEach((reward: ChestReward) => {
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
        });

        transaction.update(playerRef, {
          xp: admin.firestore.FieldValue.increment(xp),
          gold: admin.firestore.FieldValue.increment(gold),
          elo: admin.firestore.FieldValue.increment(elo),
          chests: chestsData,
        });
        if (isWinner) {
          transaction.update(playerRef, {
            wins: admin.firestore.FieldValue.increment(1),
          });
        } else {
          transaction.update(playerRef, {
            losses: admin.firestore.FieldValue.increment(1),
          });
        }

        // Iterate over the player's characters and increase their XP
        // Update XP for each character directly using their references
        if (playerData.characters) {
          playerData.characters.forEach(
            (characterRef: admin.firestore.DocumentReference) => {
              if (characterRef instanceof admin.firestore.DocumentReference) {
                // Find the corresponding CharacterRewards object
                const characterRewards =
                  characters!.find((c: any) => c.id === characterRef.id);

                if (characterRewards) {
                  const sp = characterRewards.points;
                  transaction.update(characterRef, {
                    xp: characterRewards.xp,
                    level: characterRewards.level,
                    sp: admin.firestore.FieldValue.increment(sp),
                    allTimeSP: admin.firestore.FieldValue.increment(sp),
                  });
                } else {
                  console.error(`No matching CharacterRewards found for
                    ${characterRef.id}`);
                }
              } else {
                console.error(`Invalid character reference ${characterRef}`);
              }
            });
        }
      });
      console.log("Transaction successfully committed!");

      response.send({status: 0});
    } catch (error) {
      console.error("Error processing reward:", error);
      response.status(500).send("Error");
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

async function monitorCharactersOnSale(db: any) {
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

export const generateOnSaleCharacters = onRequest((request, response) => {
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

export const listOnSaleCharacters = onRequest((request, response) => {
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

export const deleteOnSaleCharacters = onRequest((request, response) => {
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

export const purchaseCharacter = onRequest((request, response) => {
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

        // Check if player has less than 10 characters
        if (playerData.characters.length >= 10) {
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
      monitorCharactersOnSale(db);

      response.send({status: 0});
    } catch (error) {
      console.error("Error purchasing character:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const spendSP = onRequest((request, response) => {
  logger.info("Spending skill points");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      // const amount = request.body.amount;
      const amount = 1;
      const index = request.body.index as number;

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const characterRef = db.collection("characters").doc(characterId);

        const playerDoc = await transaction.get(playerRef);
        const characterDoc = await transaction.get(characterRef);

        if (!playerDoc.exists || !characterDoc.exists) {
          throw new Error("Documents do not exist");
        }

        const playerData = playerDoc.data();
        const characterData = characterDoc.data();

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        // Check that character is owned by player
        const characters =
            playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new Error("Character not owned by player");
        }

        // Check that character has enough skill points
        if (characterData.sp < amount) {
          throw new Error("Character does not have enough skill points");
        }

        const stat = statFields[index];
        const spBonuses = characterData.sp_bonuses;
        spBonuses[stat] += getSPIncrement(index) * amount;

        transaction.update(characterRef, {
          sp: admin.firestore.FieldValue.increment(-amount),
          sp_bonuses: spBonuses,
        });
      });
      console.log("Transaction successfully committed!");

      response.send({status: 0});
    } catch (error) {
      console.error("Error spending skill points:", error);
      response.status(401).send("Unauthorized");
    }
  });
});
