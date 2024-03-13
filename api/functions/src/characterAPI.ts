import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";

import {NewCharacter} from "@legion/shared/NewCharacter";
import {Class} from "@legion/shared/enums";
import {RewardsData} from "@legion/shared/interfaces";

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
      const {isWinner, xp, gold, characters} = request.body as RewardsData;

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

        // Increase player xp and number of wins or losses
        transaction.update(playerRef, {
          xp: admin.firestore.FieldValue.increment(xp),
          gold: admin.firestore.FieldValue.increment(gold),
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
          console.log("Iterating over characters...");
          playerData.characters.forEach(
            (characterRef: admin.firestore.DocumentReference) => {
              if (characterRef instanceof admin.firestore.DocumentReference) {
                // Find the corresponding CharacterRewards object
                const characterRewards =
                  characters!.find((c) => c.id === characterRef.id);

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
      response.status(401).send("Unauthorized");
    }
  });
});

async function createCharacterForSale(db: FirebaseFirestore.Firestore) {
  const level = Math.floor(Math.random() * 100);
  const price = level * 1000;
  const character =
        new NewCharacter(Class.RANDOM, level).getCharacterData();
  character.onSale = true;
  character.price = price;
  // Add the character to the collection
  await db.collection("characters").add(character);
}

export const generateOnSaleCharacters = onRequest((request, response) => {
  logger.info("Generating on sale characters");
  const db = admin.firestore();
  const TARGET_COUNT = 10;

  corsMiddleware(request, response, async () => {
    try {
      // Count how many characters have the `onSale` flag set to true
      // in the collection
      const querySnapshot = await db.collection("characters")
        .where("onSale", "==", true)
        .get();
      let onSaleCount = querySnapshot.size;
      let delta = 0;
      console.log(`Number of on sale characters: ${onSaleCount}`);
      while (onSaleCount < TARGET_COUNT) {
        await createCharacterForSale(db);
        // Increment the on sale count
        onSaleCount++;
        delta++;
      }
      response.send({delta});
    } catch (error) {
      console.error("Error generating on sale characters:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const listOnSaleCharacters = onRequest((request, response) => {
  logger.info("Listing on sale characters");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const querySnapshot = await db.collection("characters")
        .where("onSale", "==", true)
        .get();
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
      createCharacterForSale(db);

      response.send({status: 0});
    } catch (error) {
      console.error("Error purchasing character:", error);
      response.status(401).send("Unauthorized");
    }
  });
});
