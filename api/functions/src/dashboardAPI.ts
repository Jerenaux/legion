import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";

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
    const db = admin.firestore();
    const actionRef = db.collection('players').doc(playerId).collection('actions').doc();
    await actionRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        actionType,
        details,
    });
}


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

            const day1retention = calculateRetention(1, totalPlayers);
            const day7retention = calculateRetention(7, totalPlayers);
            const day30retention = calculateRetention(30, totalPlayers);
            const yesterdayRetention = calculateRetention(1, totalPlayers);

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
            });
        } catch (error) {
            console.error("DashboardData error:", error);
            response.status(500).send("Error");
        }
    });
});
