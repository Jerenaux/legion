// firebaseAdmin.ts
import * as admin from "firebase-admin";
import cors from "cors";
import {Request} from "express";
import firebaseConfig from '@legion/shared/firebaseConfig';

admin.initializeApp(firebaseConfig);

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
    // console.log(`Decoded UID ${decodedToken.uid}`);
    return decodedToken.uid;
  } catch (error) {
    return "";
  }
}

export const isDevelopment = process.env.NODE_ENV != "production";

export const checkAPIKey = (request: Request): boolean => {
  if (isDevelopment) return true;
  const apiKey = request.headers["x-api-key"];
  if (!apiKey) {
    return false;
  }

  return apiKey === process.env.API_KEY;
};

export default admin;
