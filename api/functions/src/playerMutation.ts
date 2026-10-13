import {createHash} from 'node:crypto';
import type {Response} from 'express';
import type {DBPlayerData} from '@legion/shared/interfaces';
import {AuthenticationError} from './authPolicy';
import {firestore} from './APIsetup';

export class MutationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// The receipt and the changed player state commit together, including when a response is lost.
// Keep receipts: expiring them would let an old installed client's pending request run twice.
export async function playerMutation<T>(uid: string, operation: string, requestId: unknown,
  payload: unknown, mutate: (transaction: FirebaseFirestore.Transaction,
    playerRef: FirebaseFirestore.DocumentReference, player: DBPlayerData) => Promise<T> | T): Promise<T> {
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId))) {
    throw new MutationError(400, 'Invalid request ID');
  }
  const db = firestore();
  const playerRef = db.collection('players').doc(uid);
  const receiptRef = requestId === undefined ? null : playerRef.collection('mutationReceipts').doc(requestId as string);
  const fingerprint = createHash('sha256').update(JSON.stringify([operation, payload])).digest('hex');
  return db.runTransaction(async transaction => {
    if (receiptRef) {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists) {
        if (receipt.data()?.fingerprint !== fingerprint) throw new MutationError(409, 'Request ID already used');
        return receipt.data()?.result as T;
      }
    }
    const player = await transaction.get(playerRef);
    if (!player.exists) throw new MutationError(404, 'Player not found');
    const result = await mutate(transaction, playerRef, player.data() as DBPlayerData);
    transaction.create(playerRef.collection('actions').doc(), {actionType: operation, details: payload, timestamp: new Date()});
    if (receiptRef) transaction.create(receiptRef, {operation, fingerprint, result, createdAt: new Date()});
    return result;
  });
}

export function mutationFailure(response: Response, operation: string, error: unknown) {
  if (error instanceof AuthenticationError) { response.status(401).send('Unauthorized'); return; }
  if (error instanceof MutationError) {
    response.status(error.status).send(error.message);
    return;
  }
  console.error(`${operation} error:`, error);
  response.status(500).send('Unable to complete the request. Please try again.');
}
