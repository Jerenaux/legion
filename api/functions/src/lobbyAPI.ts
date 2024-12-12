import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, { corsMiddleware, getUID, performLockedOperation } from "./APIsetup";
import {
    Connection, LAMPORTS_PER_SOL, ParsedInstruction,
    PartiallyDecodedInstruction, ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { Token } from "@legion/shared/enums";
import { GAME_WALLET, RPC } from '@legion/shared/config';

const db = admin.firestore();

async function createBaseLobbyData(uid: string, transaction: admin.firestore.Transaction) {
    // Fetch player data
    const playerDocRef = db.collection("players").doc(uid);
    const playerDoc = await transaction.get(playerDocRef);

    if (!playerDoc.exists) {
        throw new Error("Player not found");
    }

    const playerData = playerDoc.data();
    if (!playerData) {
        throw new Error("Player data not found");
    }

    return {
        playerDocRef,
        playerData,
        baseLobbyData: {
            creatorUID: uid,
            avatar: playerData.avatar,
            nickname: playerData.name,
            elo: playerData.elo,
            league: playerData.league,
            rank: playerData.leagueStats.rank,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "open",
        }
    };
}

async function createStakedLobby(
    uid: string, 
    stake: number, 
    transactionSignature: string | undefined,
    playerAddress: string,
    transaction: admin.firestore.Transaction
) {
    const { playerDocRef, playerData, baseLobbyData } = await createBaseLobbyData(uid, transaction);

    // Verify player's blockchain address
    if (!playerData.address) {
        throw new Error("Player's blockchain address not found");
    }
    if (playerAddress !== playerData.address) {
        throw new Error("Player address does not match records");
    }

    // Handle stake logic
    const currentIngameBalance = playerData.tokens?.[Token.SOL] || 0;
    const amountNeededFromOnchain = stake - currentIngameBalance;

    if (amountNeededFromOnchain > 0) {
        if (!transactionSignature) {
            throw new Error("Transaction signature is required when in-game balance is insufficient");
        }

        const transactionValid = await verifyTransaction(transactionSignature, playerAddress, amountNeededFromOnchain);
        if (!transactionValid) {
            throw new Error("Transaction verification failed");
        }

        transaction.update(playerDocRef, {
            [`tokens.${Token.SOL}`]: currentIngameBalance + amountNeededFromOnchain,
        });
    } else if (currentIngameBalance < stake) {
        throw new Error("Insufficient in-game balance");
    }

    // Deduct stake from player's balance
    transaction.update(playerDocRef, {
        [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-stake),
    });

    const lobbyData = {
        ...baseLobbyData,
        stake,
        type: 'staked'
    };

    const newLobbyRef = db.collection("lobbies").doc();
    transaction.set(newLobbyRef, lobbyData);

    return { lobbyId: newLobbyRef.id };
}

async function createFriendLobby(
    uid: string,
    opponentUID: string,
    transaction: admin.firestore.Transaction
) {
    const { baseLobbyData } = await createBaseLobbyData(uid, transaction);

    // Verify that opponent exists
    const opponentDocRef = db.collection("players").doc(opponentUID);
    const opponentDoc = await transaction.get(opponentDocRef);

    if (!opponentDoc.exists) {
        throw new Error("Opponent not found");
    }

    if (opponentUID === uid) {
        throw new Error("Cannot create a friend lobby with yourself");
    }

    const lobbyData = {
        ...baseLobbyData,
        type: 'friend',
        stake: 0,
        opponentUID,  // Pre-set the opponent
        status: 'pending'  // Different initial status for friend lobbies
    };

    const newLobbyRef = db.collection("lobbies").doc();
    transaction.set(newLobbyRef, lobbyData);

    return { lobbyId: newLobbyRef.id };
}

export const createLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const lobbyType = request.body.type || 'staked'; // Default to staked for backward compatibility

            const result = await performLockedOperation(uid, async () => {
                return db.runTransaction(async (transaction) => {
                    if (lobbyType === 'staked') {
                        const stake = Number(request.body.stake);
                        const transactionSignature = request.body.transactionSignature;
                        const playerAddress = request.body.playerAddress;
                        
                        return createStakedLobby(uid, stake, transactionSignature, playerAddress, transaction);
                    } else if (lobbyType === 'friend') {
                        const opponentUID = request.body.opponentUID;
                        if (!opponentUID) {
                            throw new Error("Opponent UID is required for friend lobbies");
                        }
                        return createFriendLobby(uid, opponentUID, transaction);
                    } else {
                        throw new Error(`Invalid lobby type: ${lobbyType}`);
                    }
                });
            });

            return response.status(200).send(result);
        } catch (error) {
            console.error("createLobby error:", error);
            if (error instanceof Error && error.message === 'Failed to acquire lock. Resource is busy.') {
                return response.status(423).send("Resource is locked. Please try again later.");
            }
            return response.status(500).send("Error creating lobby: " + (error instanceof Error ? error.message : String(error)));
        }
    });
});


// Type guard function
function isParsedInstruction(
    instruction: ParsedInstruction | PartiallyDecodedInstruction
): instruction is ParsedInstruction {
    return 'parsed' in instruction;
}

export async function fetchParsedTransactionWithRetry(
    transactionSignature: string,
    connection: Connection,
    maxRetries = 6,
    retryDelay = 2000 // milliseconds
): Promise<ParsedTransactionWithMeta | null> {
    let transaction: ParsedTransactionWithMeta | null = null;
    let attempts = 0;

    while (attempts < maxRetries) {
        attempts += 1;

        // Attempt to fetch the transaction
        transaction = await connection.getParsedTransaction(transactionSignature, 'confirmed');

        if (transaction) {
            console.log(`Transaction found on attempt ${attempts}`);
            break;
        } else {
            console.log(
                `Transaction not found on attempt ${attempts}, retrying in ${retryDelay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
    }

    if (!transaction) {
        console.error(
            `Transaction not found after ${maxRetries} attempts`
        );
    }

    return transaction;
}

async function verifyTransaction(
    transactionSignature: string,
    playerAddress: string,
    amountNeededFromOnchain: number
) {
    try {
        console.log(`[verifyTransaction] Verifying transaction: ${transactionSignature} on ${RPC}`);
        const connection = new Connection(
            RPC,
            'confirmed'
        );

        const transaction = await fetchParsedTransactionWithRetry(
            transactionSignature,
            connection,
        );

        if (!transaction) {
            console.error('Invalid transaction signature or transaction not found after retries');
            return false;
        }

        const expectedGamePublicKey = GAME_WALLET;

        const amountNeededFromOnchainLamports = Math.round(
            amountNeededFromOnchain * LAMPORTS_PER_SOL
        ); // Convert SOL to lamports

        const { meta, transaction: txn } = transaction;

        if (meta?.err) {
            console.error('Transaction failed');
            return false;
        }

        // Find the transfer instruction
        const transferInstruction = txn.message.instructions.find((ix) => {
            if (
                ix.programId.toBase58() === '11111111111111111111111111111111' &&
                isParsedInstruction(ix)
            ) {
                return ix.parsed.type === 'transfer';
            }
            return false;
        });

        if (!transferInstruction) {
            console.error('No transfer instruction found in the transaction');
            return false;
        }

        // Now we can safely access 'parsed' property
        const parsedInstruction = transferInstruction as ParsedInstruction;
        const { info } = parsedInstruction.parsed;

        if (info.source !== playerAddress) {
            console.error('Transaction source does not match player address');
            return false;
        }

        if (info.destination !== expectedGamePublicKey) {
            console.error('Transaction destination does not match game account');
            return false;
        }

        if (parseInt(info.lamports) !== amountNeededFromOnchainLamports) {
            console.error('Transaction amount does not match expected amount');
            return false;
        }

        // Prevent double-spending by checking if the transaction has been processed before
        const transactionDoc = await db
            .collection('processedTransactions')
            .doc(transactionSignature)
            .get();
        if (transactionDoc.exists) {
            console.error('Transaction has already been processed');
            return false;
        }

        // Record the transaction as processed
        await db
            .collection('processedTransactions')
            .doc(transactionSignature)
            .set({
                playerAddress: playerAddress,
                amount: amountNeededFromOnchain,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

        return true;
    } catch (error) {
        console.error('Error verifying transaction:', error);
        return false;
    }
}

async function joinStakedLobby(
    uid: string,
    lobbyData: any,
    transactionSignature: string | undefined,
    playerAddress: string,
    transaction: admin.firestore.Transaction,
    lobbyDocRef: admin.firestore.DocumentReference
) {
    // Fetch player data
    const playerDocRef = db.collection("players").doc(uid);
    const playerDoc = await transaction.get(playerDocRef);

    if (!playerDoc.exists) {
        throw new Error("Player not found");
    }

    const playerData = playerDoc.data();
    if (!playerData) {
        throw new Error("Player data not found");
    }

    if (playerAddress !== playerData.address) {
        throw new Error("Player address does not match records");
    }

    // Get player's in-game balance
    const currentIngameBalance = playerData.tokens?.[Token.SOL] || 0;
    const amountNeededFromOnchain = lobbyData.stake - currentIngameBalance;

    if (amountNeededFromOnchain > 0) {
        if (!transactionSignature) {
            throw new Error("Transaction signature is required when in-game balance is insufficient");
        }

        const transactionValid = await verifyTransaction(
            transactionSignature,
            playerAddress,
            amountNeededFromOnchain
        );

        if (!transactionValid) {
            throw new Error("Transaction verification failed");
        }

        // Update player's in-game balance
        transaction.update(playerDocRef, {
            [`tokens.${Token.SOL}`]: currentIngameBalance + amountNeededFromOnchain,
        });
    } else if (currentIngameBalance < lobbyData.stake) {
        throw new Error("Insufficient in-game balance");
    }

    // Deduct stake from player's balance
    transaction.update(playerDocRef, {
        [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-lobbyData.stake),
    });

    // Update lobby
    transaction.update(lobbyDocRef, {
        opponentUID: uid,
        status: "joined",
    });

    return { status: "joined" };
}

async function joinFriendLobby(
    uid: string,
    lobbyData: any,
    transaction: admin.firestore.Transaction,
    lobbyDocRef: admin.firestore.DocumentReference
) {
    // For friend lobbies, verify that this player is the invited opponent
    if (lobbyData.opponentUID !== uid) {
        throw new Error("You are not invited to this friend lobby");
    }

    // Update lobby status
    transaction.update(lobbyDocRef, {
        status: "joined",
    });

    return { status: "joined" };
}

export const joinLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);

            const result = await performLockedOperation(uid, async () => {
                const lobbyId = request.body.lobbyId;
                const transactionSignature = request.body.transactionSignature;
                const playerAddress = request.body.playerAddress;

                console.log(`[joinLobby] uid: ${uid}, lobbyId: ${lobbyId}`);

                return db.runTransaction(async (transaction) => {
                    // Fetch lobby data
                    const lobbyDocRef = db.collection("lobbies").doc(lobbyId);
                    const lobbyDoc = await transaction.get(lobbyDocRef);

                    if (!lobbyDoc.exists) {
                        throw new Error("Lobby not found");
                    }

                    const lobbyData = lobbyDoc.data();
                    if (!lobbyData) {
                        throw new Error("Lobby data not found");
                    }

                    if (lobbyData.creatorUID === uid) {
                        throw new Error("Cannot join own lobby");
                    }

                    // Check if lobby is already joined
                    if (lobbyData.status === "joined") {
                        throw new Error("This lobby is already full");
                    }

                    // Type-specific status checks
                    if (lobbyData.type === 'staked' && lobbyData.status !== "open") {
                        throw new Error("Lobby is not open");
                    } else if (lobbyData.type === 'friend' && lobbyData.status !== "pending") {
                        throw new Error("Friend lobby is no longer pending");
                    }

                    if (lobbyData.type === 'staked') {
                        return joinStakedLobby(
                            uid,
                            lobbyData,
                            transactionSignature,
                            playerAddress,
                            transaction,
                            lobbyDocRef
                        );
                    } else if (lobbyData.type === 'friend') {
                        return joinFriendLobby(
                            uid,
                            lobbyData,
                            transaction,
                            lobbyDocRef
                        );
                    } else {
                        throw new Error(`Invalid lobby type: ${lobbyData.type}`);
                    }
                });
            });

            return response.status(200).send(result);
        } catch (error) {
            console.error("joinLobby error:", error);
            if (error instanceof Error && error.message === 'Failed to acquire lock. Resource is busy.') {
                return response.status(423).send("Resource is locked. Please try again later.");
            }
            return response.status(500).send("Error joining lobby: " + (error instanceof Error ? error.message : String(error)));
        }
    });
});

export const cancelLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const lobbyId = request.body.lobbyId;

            const lobbyDoc = await db.collection("lobbies").doc(lobbyId).get();
            if (!lobbyDoc.exists) {
                return response.status(404).send("Lobby not found");
            }

            const lobbyData = lobbyDoc.data();

            if (!lobbyData) {
                return response.status(404).send("Lobby data not found");
            }

            if (lobbyData.creatorUID !== uid) {
                return response.status(403).send("Only the creator can cancel the lobby");
            }

            // If status is not open, do not refund stake
            if (lobbyData.status !== "open") {
                return response.status(400).send("Lobby is not open");
            }

            // Update lobby status
            await lobbyDoc.ref.update({
                status: "cancelled",
            });

            // Refund stake to creator
            await db.collection("players").doc(uid).update({
                "tokens.SOL": admin.firestore.FieldValue.increment(lobbyData.stake),
            });

            return response.status(200).send({ status: "cancelled" });
        } catch (error) {
            logger.error("cancelLobby error:", error);
            return response.status(500).send("Error cancelling lobby");
        }
    });
});

export const listLobbies = onRequest((request, response) => {
    corsMiddleware(request, response, async () => {
        try {
            const lobbiesSnapshot = await db.collection("lobbies")
                .where("status", "==", "open")
                .get();

            const lobbies = lobbiesSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    avatar: data.avatar,
                    nickname: data.nickname,
                    elo: data.elo,
                    league: data.league,
                    rank: data.rank,
                    stake: data.stake,
                };
            });

            response.status(200).send(lobbies);
        } catch (error) {
            logger.error("listLobbies error:", error);
            response.status(500).send("Error listing lobbies");
        }
    });
});

export const countLobbies = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const lobbiesSnapshot = await db.collection("lobbies")
                .where("status", "==", "open")
                .get();
            const lobbies = lobbiesSnapshot.docs.length;
            return response.status(200).send({ count: lobbies });
        } catch (error) {
            logger.error("countLobbies error:", error);
            return response.status(500).send("Error counting lobbies");
        }
    });
});

export const getLobbyDetails = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const lobbyId = request.query.lobbyId as string;

            console.log(`[getLobbyDetails] uid: ${uid}, lobbyId: ${lobbyId}`);

            if (!lobbyId) {
                return response.status(400).send("Lobby ID is required");
            }

            const lobbyDoc = await db.collection("lobbies").doc(lobbyId).get();
            if (!lobbyDoc.exists) {
                return response.status(404).send("Lobby not found");
            }

            const lobbyData = lobbyDoc.data();

            if (!lobbyData) {
                return response.status(404).send("Lobby data not found");
            }

            // Check if the requesting user is either the creator or the opponent
            if (uid !== lobbyData.creatorUID && uid !== lobbyData.opponentUID) {
                return response.status(403).send("Unauthorized to view this lobby");
            }

            // Prepare the lobby details
            const lobbyDetails = {
                id: lobbyDoc.id,
                creatorId: lobbyData.creatorUID,
                opponentId: lobbyData.opponentUID || null,
                avatar: lobbyData.avatar,
                nickname: lobbyData.nickname,
                elo: lobbyData.elo,
                league: lobbyData.league,
                rank: lobbyData.rank,
                stake: lobbyData.stake,
                status: lobbyData.status,
                createdAt: lobbyData.createdAt.toDate(),
            };

            return response.status(200).json(lobbyDetails);
        } catch (error) {
            logger.error("getLobbyDetails error:", error);
            return response.status(500).send("Error fetching lobby details");
        }
    });
});
