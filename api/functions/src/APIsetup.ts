// firebaseAdmin.ts
import * as admin from "firebase-admin";
import cors from "cors";
import {Request} from "express";

admin.initializeApp();

const corsOptions = {origin: true};
export const corsMiddleware = cors(corsOptions);

export async function getUID(request: Request): Promise<string> {
  const authToken = request.headers.authorization?.split("Bearer ")[1];
  if (!authToken) {
    throw new Error("Auth token not provided or invalid format");
  }

  try {
    // console.log(`Auth token: ${authToken}`);
    const decodedToken = await admin.auth().verifyIdToken(authToken);
    console.log(`Decoded UID ${decodedToken.uid}`);
    return decodedToken.uid;
  } catch (error) {
    return "";
  }
}

export default admin;
