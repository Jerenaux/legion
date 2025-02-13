import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {checkAPIKey, corsMiddleware, storage, isDevelopment} from "./APIsetup";
import {EndGameData, GameReplayMessage} from "@legion/shared/interfaces";
import {GameStatus, League, PlayMode} from "@legion/shared/enums";
import {logPlayerAction, updateDailyVisits} from "./dashboardAPI";
import Busboy from 'busboy';

export async function createGameDocument(
  gameId: string, players: string[], mode: PlayMode, league: League, stake: number
) {
  const db = admin.firestore();
  const gameData = {
    date: new Date(),
    gameId,
    players,
    mode,
    league,
    status: GameStatus.ONGOING,
    stake,
  };
  await db.collection("games").add(gameData);
  console.log(`[createGameDocument] Game ${gameId} created`);
}

export const createGame = onRequest({ 
  secrets: ["API_KEY"],
  memory: '512MiB'
}, (request, response) => {
  logger.info("Creating game");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      if (!checkAPIKey(request)) {
        response.status(401).send('Unauthorized');
        return;
      }
      const gameId = request.body.gameId;
      const players = request.body.players;
      const mode = request.body.mode;
      const league = request.body.league;
      const stake = request.body.stake;

      await createGameDocument(gameId, players, mode, league, stake);

      for (const player of players) {
        logPlayerAction(player, "gameStart", {
          gameId,
          league,
          mode,
          stake,
        });
      }

      response.status(200).send({status: 0});
    } catch (error) {
      console.error("createGame error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const completeGame = onRequest({ 
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const gameId = request.body.gameId;
      const winnerUID = request.body.winnerUID || -1; // -1 for AI
      const rawResults: EndGameData = request.body.results;
      console.log(`[completeGame] Game ${gameId} completed, results: ${JSON.stringify(rawResults)}`);
      // Filter out the results object to remove keys that are empty strings or undefined
      const results = Object.fromEntries(
        Object.entries(rawResults).filter(([key, value]) => key !== '' && value !== undefined)
      );
      console.log(`[completeGame] Filtered results: ${JSON.stringify(results)}`);

      const gameRef = await db.collection("games").where("gameId", "==", gameId).limit(1).get();
      if (gameRef.empty) { // Most likely a tutorial ending
        // throw new Error("Invalid game ID");
        response.status(200).send({status: 0});
        return; // Exit the function early
      }

      const gameDoc = gameRef.docs[0];
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new Error("gameData is null");
      }

      for (const player of gameData.players) {
        if (player) { // Add a check to ensure player is not undefined or empty string
          logPlayerAction(player, "gameComplete", {
            gameId,
            winner: winnerUID == player,
            results: results[player as keyof EndGameData],
            league: gameData.league,
            mode: gameData.mode,
          });
        }
      }

      const newGameData = {
        status: GameStatus.COMPLETED,
        winner: winnerUID,
        results,
        end: new Date(),
      };

      // Only add results to newGameData if it's not empty
      if (Object.keys(results).length > 0) {
        newGameData['results'] = results;
      }

      await gameDoc.ref.update(newGameData);
      response.status(200).send({status: 0});
    } catch (error) {
      console.error("[completeGame] Error:", error);
      response.status(500).send("Error");
    }
  });
});

export const getNews = onRequest({ 
  memory: '512MiB' 
},(request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const limit = parseInt(request.query.limit as string) || 3;
      const isFrontPage = request.query.isFrontPage === 'true';
      const visitorId = request.query.visitorId;
      
      // If this is a front page visit, update the daily visits counter
      if (isFrontPage) {
        await updateDailyVisits(visitorId as string);
      }
      
      // Get all news
      const newsCollection = db.collection("news");
      const allNewsSnapshot = await newsCollection.get();
      const allNews = allNewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by date (newest first)
      const sortByDateDesc = (a: any, b: any) => {
        const dateA = a.date || '0000-00-00';
        const dateB = b.date || '0000-00-00';
        return dateB.localeCompare(dateA);
      };
      
      if (!isFrontPage) {
        // Separate pinned and unpinned news
        const pinnedNews = allNews.filter((news: any) => news.pinned);
        const unpinnedNews = allNews.filter((news: any) => !news.pinned);
        
        // Sort unpinned news by date
        const sortedUnpinnedNews = unpinnedNews.sort(sortByDateDesc);
        
        // Take only what we need from unpinned news, considering we'll add pinned ones
        const unpinnedToKeep = Math.max(0, limit - pinnedNews.length);
        const result = [
          ...sortedUnpinnedNews.slice(0, unpinnedToKeep),
          ...pinnedNews
        ];
        
        response.status(200).json(result);
      } else {
        // Regular sorting by date only
        const sortedNews = allNews.sort(sortByDateDesc);
        response.status(200).json(sortedNews.slice(0, limit));
      }
    } catch (error) {
      console.error("getNews error:", error);
      response.status(500).send("Error fetching news");
    }
  });
});

export const addNews = onRequest({
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
      console.log(`[addNews] Processing news upload...`);

      // Handle multipart form data
      const busboy = Busboy({ headers: request.headers });
      const fields: any = {};
      let imageBuffer: Buffer | null = null;
      let imageType: string | null = null;

      // Handle regular fields
      busboy.on('field', (fieldname: string, val: any) => {
        fields[fieldname] = val;
      });

      // Handle file upload - skip in development
      if (!isDevelopment) {
        busboy.on('file', (_fieldname: string, file: any, { mimeType }: { mimeType: string }) => {
          console.log(`[addNews] Processing file upload...`);
          const chunks: Buffer[] = [];
          imageType = mimeType;

          file.on('data', (data: Buffer) => {
            chunks.push(data);
          });

          file.on('end', () => {
            if (chunks.length) {
              imageBuffer = Buffer.concat(chunks);
            }
          });
        });
      }

      console.log(`[addNews] Busboy setup complete...`);
      // Process the upload when everything is done
      const result = await new Promise((resolve, reject) => {
        busboy.on('finish', async () => {
          try {
            console.log(`[addNews] Processing finished...`);
            // Validate required fields
            if (!fields.title || !fields.text || !fields.date) {
              reject(new Error("Missing required fields (title, text, date)"));
              return;
            }

            let imageUrl = null;

            // Handle image upload if present and not in development
            if (imageBuffer && !isDevelopment) {
              const ext = imageType?.split('/')[1] || 'jpg';
              const filename = `news-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
              
              console.log(`[addNews] Uploading image to ${filename} ...`);
              const bucket = storage.bucket('legion-32c6d.firebasestorage.app');
              console.log(`[addNews] Bucket name: ${bucket.name}`);
              
              try {
                const file = bucket.file(filename);
                await file.save(imageBuffer, {
                  metadata: {
                    contentType: imageType,
                  }
                });
                await file.makePublic();
                imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
              } catch (error) {
                console.error('[addNews] Storage error:', error);
                // @ts-ignore
                throw new Error(`Storage error: ${error.message}`);
              }
            }

            const newsData = {
              title: fields.title,
              text: fields.text,
              date: fields.date,
              pinned: fields.pinned === 'true',
              link: fields.link || null,
              category: fields.category || 'general',
              imageUrl: isDevelopment ? (fields.imageUrl || null) : imageUrl,
              createdAt: new Date()
            };

            const docRef = await db.collection("news").add(newsData);
            resolve({ 
              status: "success", 
              message: "News added successfully",
              id: docRef.id,
              imageUrl: newsData.imageUrl 
            });
          } catch (error) {
            reject(error);
          }
        });

        busboy.on('error', reject);
        
        // Feed the request data into busboy
        if (request.rawBody) {
          busboy.end(request.rawBody);
        } else {
          request.pipe(busboy);
        }
      });

      response.status(200).json(result);
    } catch (error) {
      console.error("addNews error:", error);
      // @ts-ignore
      if (error.message === "Missing required fields (title, text, date)") {
        // @ts-ignore
        response.status(400).send(error.message);
      } else {
        response.status(500).send("Error adding news");
      }
    }
  });
});

export const saveReplay = onRequest({ 
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

      const { gameId, messages, duration, mode } = request.body;

      // Validate required fields
      if (!gameId || !messages || !Array.isArray(messages)) {
        response.status(400).send("Bad Request: Missing or invalid required fields");
        return;
      }

      // Create replay data object
      const replayData = {
        messages: messages as GameReplayMessage[],
        duration,
        mode,
        savedAt: new Date(),
      };

      // Find the game document and update it with replay data
      const gameRef = await db.collection("games")
        .where("gameId", "==", gameId)
        .limit(1)
        .get();

      if (gameRef.empty) {
        response.status(404).send("Game not found");
        return;
      }

      await gameRef.docs[0].ref.update({ replay: replayData });

      response.status(200).send({status: 0});
    } catch (error) {
      console.error("saveReplay error:", error);
      response.status(500).send("Error saving replay");
    }
  });
});

export const getReplay = onRequest({
  memory: '512MiB'
}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const gameId = request.query.id;
      if (!gameId) {
        response.status(400).send("Bad Request: Missing game ID");
        return;
      }

      const gameRef = await db.collection("games")
        .where("gameId", "==", gameId.toString())
        .limit(1)
        .get();

      if (gameRef.empty) {
        response.status(404).send("Game not found");
        return;
      }

      const gameData = gameRef.docs[0].data();
      if (!gameData.replay) {
        response.status(404).send("Replay not found");
        return;
      }

      response.status(200).json(gameData.replay);
    } catch (error) {
      console.error("getReplay error:", error);
      response.status(500).send("Error fetching replay");
    }
  });
});
