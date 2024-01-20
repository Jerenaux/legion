import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, {corsMiddleware, getUID} from "./APIsetup";


import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Class, RewardsData} from "@legion/shared/types";

export const createUserCharacter = functions.auth.user().onCreate((user) => {
  logger.info("Creating character for user:", user.uid);
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(user.uid);

  // Define the character data structure
  const playerData = {
    name: uniqueNamesGenerator({dictionaries: [adjectives, colors, animals]}),
    gold: 100,
    carrying_capacity: 50,
    inventory: [0, 0, 0, 1, 1, 2, 3, 3],
    characters: [] as admin.firestore.DocumentReference[],
    elo: 100,
    wins: 0,
    losses: 0,
    crowd: 3,
    xp: 0,
    lvl: 1,
  };

  // Start a batch to ensure atomicity
  const batch = db.batch();

  // Add player document to batch
  batch.set(playerRef, playerData);

  const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
  const characterDataArray = [];
  // Repeat 3 times
  for (let i = 0; i < 3; i++) {
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
      const {isWinner, xp, gold} = request.body as RewardsData;

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
                transaction.update(characterRef, {
                  xp: admin.firestore.FieldValue.increment(xp),
                });
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
        const level = Math.floor(Math.random() * 100);
        const price = level * 1000;
        const character =
            new NewCharacter(Class.RANDOM, level).getCharacterData();
        character.onSale = true;
        character.price = price;
        // Add the character to the collection
        await db.collection("characters").add(character);
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
      const characters = querySnapshot.docs.map((doc) => doc.data());
      response.send(characters);
    } catch (error) {
      console.error("Error listing on sale characters:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

