import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {checkAPIKey, corsMiddleware, getUID} from "./APIsetup";

interface RetentionData {
    returningPlayers: number;
    retentionRate: number;
}

interface DashboardData {
    DAU: {
        date: string;
        userCount: number;
    }[];
    totalPlayers: number;
    day1retention: RetentionData;
    day7retention: RetentionData;
    day30retention: RetentionData;
    yesterdayRetention: RetentionData;
    newPlayersPerDay: { [key: string]: number };
    gamesPerModePerDay: GamesPerModePerDay;
    medianGameDuration: number;
}
interface GamesPerModePerDay {
    [date: string]: {
        [mode: string]: number;
    };
}

interface EngagementMetrics {
    totalPlayers: number;
    tutorialCompletionRate: number;
    playedOneGameRate: number;
    playedMultipleGamesRate: number;
}

interface TutorialDropoffStats {
    totalPlayers: number;
    dropoffPoints: {
        [tutorialStep: string]: {
            count: number;
            percentage: number;
        }
    };
    averageLastStep: string;
}

export async function updateDAU(userId: string) {
    const db = admin.firestore();
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    const docRef = db.collection("dailyActiveUsers").doc(today);

    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        if (!doc.exists) {
            transaction.set(docRef, {users: [userId]});
        } else {
            const docData = doc.data();
            const users = docData && docData.users ? docData.users : [];
            if (!users.includes(userId)) {
                users.push(userId);
                transaction.update(docRef, {users: users});
            }
        }
    });
}

export async function logPlayerAction(playerId: string, actionType: string, details: any) {
    if (!playerId || playerId === '' || playerId === undefined || playerId === null) return;
    console.log(`[logPlayerAction] playerId: ${playerId}, actionType: ${actionType}, details: ${JSON.stringify(details)}`);
    const db = admin.firestore();
    const actionRef = db.collection('players').doc(playerId).collection('actions').doc();
    await actionRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actionType,
        details,
    });
}

export async function logGameAction(gameId: string, playerId: string, actionType: string, details: any) {
    console.log(`Logging game action: ${gameId}, ${playerId}, ${actionType}, ${details}`);
    const db = admin.firestore();

    // Query for the document where the field gameId matches the provided gameId
    const gameQuerySnapshot = await db.collection('games').where('gameId', '==', gameId).limit(1).get();

    if (gameQuerySnapshot.empty) {
        console.error(`No game found with gameId: ${gameId}`);
        return;
    }

    const gameDoc = gameQuerySnapshot.docs[0];
    const actionRef = gameDoc.ref.collection('actions').doc();

    await actionRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        playerId,
        actionType,
        details,
    });
}

export const logQueuingActivity = onRequest({ secrets: ["API_KEY"] }, async (request, response) => {
    if (!checkAPIKey(request)) {
        response.status(401).send('Unauthorized');
        return;
    }
    const { playerId, actionType, details } = request.body;
    await logPlayerAction(playerId, actionType, details);
    response.send({status: 0});
});

export const insertGameAction = onRequest(async (request, response) => {
    const { gameId, playerId, actionType, details } = request.body;
    await logGameAction(gameId, playerId, actionType, details);
    response.send({status: 0});
});


export const getDashboardData = onRequest(async (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const startDate = request.query.startDate;
            const endDate = request.query.endDate;

            const query = db.collection("dailyActiveUsers");
            if (startDate && endDate) {
                query.where(admin.firestore.FieldPath.documentId(), ">=", startDate)
                    .where(admin.firestore.FieldPath.documentId(), "<=", endDate);
            }

            const snapshot = await query.get();
            const data = snapshot.docs.map((doc) => ({
                date: doc.id,
                userCount: doc.data().users.length,
            }));

            const playersSnapshot = await db.collection("players").get();
            const totalPlayers = playersSnapshot.size;

            const calculateRetention = (days: number, totalPlayers: number) => {
                let returningPlayers = 0;

                playersSnapshot.forEach((doc) => {
                    const { joinDate, lastActiveDate } = doc.data();

                    if (joinDate && lastActiveDate) {
                        const joinDateObj = new Date(joinDate);
                        const lastActiveDateObj = new Date(lastActiveDate);

                        if (!isNaN(joinDateObj.getTime()) && !isNaN(lastActiveDateObj.getTime())) {
                            const daysActive = (lastActiveDateObj.getTime() - joinDateObj.getTime()) / (1000 * 60 * 60 * 24);

                            if (daysActive >= days) {
                                returningPlayers++;
                            }
                        }
                    }
                });

                const retentionRate = totalPlayers > 0 ? (returningPlayers / totalPlayers) * 100 : 0;
                return { returningPlayers, retentionRate };
            };

            const calculateInactivePlayers = () => {
                const inactivePlayerIds: string[] = [];

                playersSnapshot.forEach((doc) => {
                    const { joinDate, lastActiveDate } = doc.data();
                    const playerId = doc.id;

                    if (joinDate && lastActiveDate) {
                        const joinDateObj = new Date(joinDate);
                        const lastActiveDateObj = new Date(lastActiveDate);

                        if (!isNaN(joinDateObj.getTime()) && !isNaN(lastActiveDateObj.getTime())) {
                            const daysActive = (lastActiveDateObj.getTime() - joinDateObj.getTime()) / (1000 * 60 * 60 * 24);
                            const now = new Date();
                            const daysSinceLastActive = (now.getTime() - lastActiveDateObj.getTime()) / (1000 * 60 * 60 * 24);

                            if (daysActive > 1 && daysSinceLastActive > 2) {
                                inactivePlayerIds.push(playerId);
                            }
                        }
                    }
                });

                return inactivePlayerIds;
            };

            const day1retention = calculateRetention(1, totalPlayers);
            const day7retention = calculateRetention(7, totalPlayers);
            const day30retention = calculateRetention(30, totalPlayers);
            const yesterdayRetention = calculateRetention(1, totalPlayers);

            const inactivePlayerIds = calculateInactivePlayers();

            const newPlayersPerDay: { [key: string]: number } = {};
            playersSnapshot.forEach((doc) => {
                const { joinDate } = doc.data();
                if (joinDate) {
                    const joinDateStr = new Date(joinDate).toISOString().split('T')[0];
                    if (!newPlayersPerDay[joinDateStr]) {
                        newPlayersPerDay[joinDateStr] = 0;
                    }
                    newPlayersPerDay[joinDateStr]++;
                }
            });

            // Calculate the number of games of each mode per day
            const gamesSnapshot = await db.collection("games").get();
            const gamesPerModePerDay: GamesPerModePerDay = {};
            const gameDurations: number[] = [];
            gamesSnapshot.forEach((doc) => {
                const { date, mode, end } = doc.data();
                if (date) {
                    const dateObj = date.toDate();
                    if (end) {
                        const endObj = end.toDate();
                        const duration = (endObj.getTime() - dateObj.getTime()) / (1000 * 60); // Duration in minutes
                        gameDurations.push(duration);
                    }

                    const dateStr = dateObj.toISOString().split('T')[0];
                    if (!gamesPerModePerDay[dateStr]) {
                        gamesPerModePerDay[dateStr] = {};
                    }
                    if (!gamesPerModePerDay[dateStr][mode]) {
                        gamesPerModePerDay[dateStr][mode] = 0;
                    }
                    gamesPerModePerDay[dateStr][mode]++;
                }
            });

            // Calculate median game duration
            const medianGameDuration = gameDurations.length > 0 ? gameDurations.sort((a, b) => a - b)[Math.floor(gameDurations.length / 2)] : 0;

            response.send({
                DAU: data,
                day1retention,
                day7retention,
                day30retention,
                yesterdayRetention,
                newPlayersPerDay,
                gamesPerModePerDay,
                totalPlayers,
                medianGameDuration,
                inactivePlayerIds,
            });
        } catch (error) {
            console.error("DashboardData error:", error);
            response.status(500).send("Error");
        }
    });
});

export const getActionLog = onRequest(async (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const playerId = request.query.playerId;
            if (!playerId) {
                response.status(400).send(" Bad Request: Missing player ID");
                return;
            }

            // Fetch the player's action log
            const actionLogSnapshot = await db.collection("players")
                .doc(playerId.toString()).collection("actions")
                .orderBy("timestamp", "asc").limit(100).get();
            const actionLog = actionLogSnapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            }));

            // Extract game IDs from the action log
            const gameIdSet = new Set();
            actionLog.forEach((action) => {
                // @ts-ignore
                const details = action.details || {};
                const gameId = details.gameId;
                if (gameId) {
                    gameIdSet.add(gameId);
                }
            });
            const gamesPlayed = Array.from(gameIdSet);

            // Fetch the player's summary data
            const playerDoc = await db.collection("players").doc(playerId.toString()).get();
            if (!playerDoc.exists) {
                response.status(404).send("Player not found");
                return;
            }
            const playerData = playerDoc.data();
            // @ts-ignore
            const { gold, rank, leagueStats, allTimeStats, characters, lossesStreak, utilizationStats, joinDate, lastActiveDate } = playerData;

            // Fetch character details
            const characterDetails = [];
            for (const characterRef of characters) {
                const characterDoc = await characterRef.get();
                if (characterDoc.exists) {
                    const characterData = characterDoc.data();
                    characterDetails.push({
                        id: characterDoc.id,
                        level: characterData.level,
                        xp: characterData.xp,
                        sp: characterData.sp,
                        allTimeSP: characterData.allTimeSP,
                        skills: characterData.skills,
                        inventory: characterData.inventory,
                        equipment: characterData.equipment,
                    });
                }
            }

            // Prepare the player summary
            const playerSummary = {
                gold,
                rank: leagueStats.rank,
                allTimeRank: allTimeStats.rank,
                lossesStreak: allTimeStats.lossesStreak,
                characters: characterDetails,
                utilizationStats,
                joinDate,
                lastActiveDate,
            };

            // Send the response including joinDate, lastActiveDate, and gamesPlayed
            response.send({
                actionLog,
                playerSummary,
                gamesPlayed,
            });
        } catch (error) {
            console.error("getActionLog error:", error);
            response.status(500).send("Error");
        }
    });
});

export const getGameLog = onRequest(async (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const gameId = request.query.gameId;
            if (!gameId) {
                response.status(400).send("Bad Request: Missing game ID");
                return;
            }

            // Query for the document where the field gameId matches the provided gameId
            const gameQuerySnapshot = await db.collection('games').where('gameId', '==', gameId.toString()).limit(1).get();

            if (gameQuerySnapshot.empty) {
                response.status(404).send("Not Found: No game found with the provided game ID");
                return;
            }

            const gameDoc = gameQuerySnapshot.docs[0];
            const snapshot = await gameDoc.ref.collection("actions")
                .orderBy("timestamp", "asc").limit(100).get();

            const data = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            }));

            response.send(data);
        } catch (error) {
            console.error("getGameLog error:", error);
            response.status(500).send("Error");
        }
    });
});

export const listPlayerIDs = onRequest(async (request, response) => {
    const db = admin.firestore();
    corsMiddleware(request, response, async () => {
        // if (!checkAPIKey(request)) {
        //     response.status(401).send('Unauthorized');
        //     return;
        // }
        // Return a list of all player IDs together with their joinDate
        const snapshot = await db.collection("players").get();
        const players = snapshot.docs.map((doc) => ({
            id: doc.id,
            joinDate: doc.data().joinDate,
        }));
        response.send(players);
    });
});

export const getEngagementMetrics = onRequest(async (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const startDate = request.query.date;
            if (!startDate) {
                response.status(400).send("Bad Request: Missing date parameter");
                return;
            }

            // Get all players who joined after the start date
            const playersSnapshot = await db.collection("players")
                .where("joinDate", ">=", startDate)
                .get();

            const totalPlayers = playersSnapshot.size;
            if (totalPlayers === 0) {
                response.send({
                    totalPlayers: 0,
                    tutorialCompletionRate: 0,
                    playedOneGameRate: 0,
                    playedMultipleGamesRate: 0
                });
                return;
            }

            let completedTutorial = 0;
            let playedOneGame = 0;
            let playedMultipleGames = 0;

            // Process each player
            for (const playerDoc of playersSnapshot.docs) {
                // Check tutorial completion
                const tutorialActions = await playerDoc.ref
                    .collection("actions")
                    .where("actionType", "==", "tutorial")
                    .where("details", "==", "coda")
                    .limit(1)
                    .get();
                
                if (!tutorialActions.empty) {
                    completedTutorial++;
                }

                // Check games played
                const gamesQuery = await db.collection("games")
                    .where("players", "array-contains", playerDoc.id)
                    .get();

                const gamesCount = gamesQuery.size;
                if (gamesCount >= 1) {
                    playedOneGame++;
                }
                if (gamesCount > 1) {
                    playedMultipleGames++;
                }
            }

            const metrics: EngagementMetrics = {
                totalPlayers,
                tutorialCompletionRate: (completedTutorial / totalPlayers) * 100,
                playedOneGameRate: (playedOneGame / totalPlayers) * 100,
                playedMultipleGamesRate: (playedMultipleGames / totalPlayers) * 100
            };

            response.send(metrics);
        } catch (error) {
            console.error("getEngagementMetrics error:", error);
            response.status(500).send("Error calculating engagement metrics");
        }
    });
});

export const getTutorialDropoffStats = onRequest(async (request, response) => {
    const db = admin.firestore();

    corsMiddleware(request, response, async () => {
        try {
            const startDate = request.query.date;
            if (!startDate) {
                response.status(400).send("Bad Request: Missing date parameter");
                return;
            }

            // Get all players who joined after the start date
            const playersSnapshot = await db.collection("players")
                .where("joinDate", ">=", startDate)
                .get();

            const totalPlayers = playersSnapshot.size;
            if (totalPlayers === 0) {
                response.send({
                    totalPlayers: 0,
                    dropoffPoints: {},
                    averageLastStep: "none"
                });
                return;
            }

            // Collect all unique tutorial steps and count occurrences
            const dropoffPoints: { [key: string]: number } = {};
            const stepOrder: string[] = []; // To keep track of step discovery order

            // Process each player
            for (const playerDoc of playersSnapshot.docs) {
                // Get all tutorial actions for this player
                const tutorialActions = await playerDoc.ref
                    .collection("actions")
                    .where("actionType", "==", "tutorial")
                    .orderBy("timestamp", "desc")
                    .limit(1)
                    .get();

                if (!tutorialActions.empty) {
                    const lastAction = tutorialActions.docs[0].data();
                    const lastStep = lastAction.details;
                    
                    if (typeof lastStep === 'string') {
                        // Add step to order list if it's new
                        if (!stepOrder.includes(lastStep)) {
                            stepOrder.push(lastStep);
                        }
                        
                        // Increment count for this step
                        dropoffPoints[lastStep] = (dropoffPoints[lastStep] || 0) + 1;
                    }
                }
            }

            // Calculate percentages and format response
            const stats: TutorialDropoffStats = {
                totalPlayers,
                dropoffPoints: {},
                averageLastStep: "none"
            };

            // Calculate weighted average to find average last step
            let weightedSum = 0;
            stepOrder.forEach((step, index) => {
                const count = dropoffPoints[step] || 0;
                stats.dropoffPoints[step] = {
                    count,
                    percentage: (count / totalPlayers) * 100
                };
                weightedSum += index * count;
            });

            const averageStepIndex = stepOrder.length > 0 ? 
                Math.round(weightedSum / totalPlayers) : -1;
            stats.averageLastStep = averageStepIndex >= 0 ? 
                stepOrder[averageStepIndex] : "none";

            response.send(stats);
        } catch (error) {
            console.error("getTutorialDropoffStats error:", error);
            response.status(500).send("Error calculating tutorial dropoff stats");
        }
    });
});

