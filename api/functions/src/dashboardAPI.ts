import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {DAUData} from "@legion/shared/dashboardInterfaces";

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

export const getDAUData = onRequest(async (request, response) => {
    logger.info("Fetching DAU data");
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
            const data: DAUData[] = [];
            snapshot.forEach((doc) => {
                data.push({
                    date: doc.id,
                    userCount: doc.data().users.length,
                });
            });

            response.send(data);
        } catch (error) {
            console.error("getDAUData error:", error);
            response.status(500).send("Error");
        }
    });
});
