import {onRequest} from "firebase-functions/v2/https";

import admin, {corsMiddleware, getUID} from "./APIsetup";
import {
  PlatformProvider,
  canonicalUID,
  identityKey,
  validateDirectDevice,
  validateItchKey,
  validateSteamTicket,
} from "./platformIdentity";
import {ensurePlayer} from "./playerAPI";

class PlatformIdentityConflictError extends Error {}

const steamConfig = () => ({
  appId: process.env.STEAM_APP_ID || "",
  apiKey: process.env.STEAM_WEB_API_KEY || "",
  identity: process.env.STEAM_WEB_API_IDENTITY || "legion",
});

async function validateProvider(provider: PlatformProvider, credential: string): Promise<string> {
  if (provider === "steam") return validateSteamTicket(credential, steamConfig());
  if (provider === "itch") return validateItchKey(credential);
  if (provider === "direct") return validateDirectDevice(credential);
  throw new Error("Unsupported platform provider");
}

async function resolveUID(
  provider: PlatformProvider,
  externalId: string,
  linkToUID?: string,
): Promise<string> {
  const db = admin.firestore();
  const key = identityKey(provider, externalId);
  const identityRef = db.collection("platformIdentities").doc(key);

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(identityRef);
    if (existing.exists) {
      const uid = existing.data()?.uid as string;
      if (linkToUID && uid !== linkToUID) {
        throw new PlatformIdentityConflictError("Platform identity is already linked");
      }
      return uid;
    }

    const uid = linkToUID || canonicalUID(key);
    transaction.create(identityRef, {
      provider,
      externalId,
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return uid;
  });
}

async function ensureAuthUser(uid: string): Promise<void> {
  try {
    await admin.auth().getUser(uid);
  } catch (error) {
    if ((error as any)?.code !== "auth/user-not-found") throw error;
    await admin.auth().createUser({uid});
  }
}

// ponytail: bind Steam secrets here once production Steam credentials are provisioned.
const sessionOptions = {
  memory: "512MiB" as const,
};

export const createPlatformSession = onRequest(sessionOptions, (request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const provider = request.body?.provider as PlatformProvider;
      const credential = request.body?.credential as string;
      const externalId = await validateProvider(provider, credential);
      const uid = await resolveUID(provider, externalId);
      await ensureAuthUser(uid);
      await ensurePlayer(uid);
      const customToken = await admin.auth().createCustomToken(uid, {platform: provider});
      response.send({customToken, provider, uid});
    } catch (error) {
      console.error("createPlatformSession error:", error);
      response.status(401).send("Platform authentication failed");
    }
  });
});

export const linkPlatformIdentity = onRequest(sessionOptions, (request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      let uid: string;
      try {
        uid = await getUID(request);
      } catch (error) {
        console.warn("linkPlatformIdentity authentication failed:", error);
        response.status(401).send("Authentication required");
        return;
      }

      const provider = request.body?.provider;
      const credential = request.body?.credential;
      if (provider === "direct") {
        response.status(400).send("Direct device accounts cannot be linked");
        return;
      }
      if ((provider !== "steam" && provider !== "itch") || typeof credential !== "string" || !credential) {
        response.status(400).send("Valid platform credentials are required");
        return;
      }

      let externalId: string;
      try {
        externalId = await validateProvider(provider, credential);
      } catch (error) {
        console.warn("linkPlatformIdentity platform authentication failed:", error);
        response.status(401).send("Platform authentication failed");
        return;
      }

      try {
        await resolveUID(provider, externalId, uid);
      } catch (error) {
        if (error instanceof PlatformIdentityConflictError) {
          response.status(409).send(error.message);
          return;
        }
        throw error;
      }
      response.send({provider, uid});
    } catch (error) {
      console.error("linkPlatformIdentity error:", error);
      response.status(500).send("Unable to link platform identity");
    }
  });
});
