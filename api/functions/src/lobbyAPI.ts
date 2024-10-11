import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, { corsMiddleware, getUID } from "./APIsetup";
import {
    Connection, LAMPORTS_PER_SOL, ParsedInstruction,
    PartiallyDecodedInstruction, ParsedTransactionWithMeta, Commitment,
} from '@solana/web3.js';
import { Token } from "@legion/shared/enums";
import { GAME_WALLET, RPC } from '@legion/shared/config';

const db = admin.firestore();

export const createLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const stake = Number(request.body.stake);
            const transactionSignature = request.body.transactionSignature;
            const playerAddress = request.body.playerAddress; // Add playerAddress from request body

            console.log(`[createLobby] uid: ${uid}, stake: ${stake}`);

            // Fetch player data
            const playerDoc = await db.collection("players").doc(uid).get();
            if (!playerDoc.exists) {
                return response.status(404).send("Player not found");
            }
            const playerData = playerDoc.data();

            if (!playerData) {
                return response.status(404).send("Player data not found");
            }

            if (!playerData.address) {
                return response.status(400).send("Player's blockchain address not found");
            }

            // Verify that the provided playerAddress matches the stored address
            if (playerAddress !== playerData.address) {
                return response.status(400).send("Player address does not match records");
            }

            // Get player's in-game balance
            const currentIngameBalance = playerData.tokens?.[Token.SOL] || 0;

            // Calculate the amount needed from on-chain balance
            const amountNeededFromOnchain = stake - currentIngameBalance;

            if (amountNeededFromOnchain > 0) {
                // If in-game balance is insufficient, verify the transaction
                if (!transactionSignature) {
                    return response.status(400).send("Transaction signature is required when in-game balance is insufficient");
                }

                // Call the separate transaction verification method
                const transactionValid = await verifyTransaction(transactionSignature, playerAddress, amountNeededFromOnchain);

                if (!transactionValid) {
                    return response.status(400).send("Transaction verification failed");
                }

                // Update player's in-game balance
                const newIngameBalance = currentIngameBalance + amountNeededFromOnchain;

                await playerDoc.ref.update({
                    [`tokens.${Token.SOL}`]: newIngameBalance,
                });
            } else {
                // If no on-chain funds are needed, ensure the in-game balance is sufficient
                if (currentIngameBalance < stake) {
                    return response.status(400).send("Insufficient in-game balance");
                }
            }

            // Deduct stake from player's balance
            await playerDoc.ref.update({
                [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-stake),
            });

            // Create lobby document
            const lobbyData = {
                creatorUID: uid,
                avatar: playerData.avatar,
                nickname: playerData.name,
                elo: playerData.elo,
                league: playerData.league,
                rank: playerData.leagueStats.rank,
                stake: stake,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "open",
            };

            const lobbyRef = await db.collection("lobbies").add(lobbyData);

            return response.status(200).send({ lobbyId: lobbyRef.id });
        } catch (error) {
            console.error("createLobby error:", error);
            return response.status(500).send("Error creating lobby");
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
    maxRetries = 5,
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
        console.log(`[verifyTransaction] Verifying transaction: ${transactionSignature}`);
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

export const joinLobby = onRequest((request, response) => {
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

            if (lobbyData.opponentUID) {
                return response.status(400).send("Lobby is full");
            }

            if (lobbyData.creatorUID === uid) {
                return response.status(400).send("Cannot join own lobby");
            }

            if (lobbyData.status !== "open") {
                return response.status(400).send("Lobby is not open");
            }

            const playerDoc = await db.collection("players").doc(uid).get();
            if (!playerDoc.exists) {
                return response.status(404).send("Player not found");
            }
            const playerData = playerDoc.data();

            if (!playerData) {
                return response.status(404).send("Player data not found");
            }

            if (playerData.tokens.SOL < lobbyData.stake) {
                return response.status(400).send("Insufficient balance");
            }

            // Update lobby
            await lobbyDoc.ref.update({
                opponentUID: uid,
                status: "joined",
            });

            // Deduct stake from player's balance
            await playerDoc.ref.update({
                "tokens.SOL": admin.firestore.FieldValue.increment(-lobbyData.stake),
            });

            return response.status(200).send({ status: "joined" });
        } catch (error) {
            logger.error("joinLobby error:", error);
            return response.status(500).send("Error joining lobby");
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
