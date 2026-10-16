import {balanceCharacter} from '@legion/shared/characterBalance';
import type {DBCharacterData} from '@legion/shared/interfaces';

// Every character read and write goes through these helpers, so a stored build always
// matches its class, level, SP allocations and equipment, and nothing persists stale stats.
export function readCharacter(doc: FirebaseFirestore.DocumentSnapshot<unknown>): DBCharacterData {
  return balanceCharacter(doc.data() as DBCharacterData);
}

export function writeCharacter(transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference<unknown>, data: DBCharacterData, extra: Partial<DBCharacterData> = {}) {
  transaction.update(ref, {...balanceCharacter(data), ...extra});
}

/** The character as sent to clients: balanced, with the pre-rebalance backup left out. */
export function publicCharacter(doc: FirebaseFirestore.DocumentSnapshot<unknown>) {
  const {legacyBalance, ...data} = readCharacter(doc);
  return {id: doc.id, ...data};
}
