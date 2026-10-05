// Privileged operator CLI. Uses ADC (or FIRESTORE_EMULATOR_HOST), never a public admin endpoint.
import {randomBytes} from 'node:crypto';
import {parseArgs} from 'node:util';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Firestore} from 'firebase-admin/firestore';
import {OAuth2Client} from 'google-auth-library';
import {giftId, giftTokenPattern, validateGiftRewards} from '../src/gifts';

const {values, positionals} = parseArgs({args: process.argv.slice(2), allowPositionals: true, options: {
  project: {type: 'string'}, label: {type: 'string'}, rewards: {type: 'string'}, expires: {type: 'string'}, id: {type: 'string'},
  gcloud: {type: 'boolean'},
}});
const usage = 'bun tools/gifts.ts <create|list|inspect|revoke> --project PROJECT [--label NAME --rewards FILE.json --expires ISO_DATE | --id GIFT_ID]';
try {
  if (!values.project || !['create', 'list', 'inspect', 'revoke'].includes(positionals[0])) throw new Error(usage);
  const authClient = values.gcloud ? new OAuth2Client() : undefined;
  if (authClient) authClient.setCredentials({
    access_token: execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(),
    expiry_date: Date.now() + 3600000,
  });
  const db = new Firestore({projectId: values.project, ...(authClient ? {authClient} : {})});
  const gifts = db.collection('creatorGifts');
  const command = positionals[0];
  if (command === 'create') {
    if (!values.label?.trim() || values.label.length > 120 || !values.rewards) throw new Error(usage);
    const rewards = validateGiftRewards(JSON.parse(readFileSync(values.rewards, 'utf8')));
    const expiresAt = values.expires ? Date.parse(values.expires) : null;
    if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())) throw new Error('Expiry must be in the future');
    const token = randomBytes(32).toString('hex');
    const id = giftId(token);
    await gifts.doc(id).create({label: values.label.trim(), rewards, createdAt: Date.now(), expiresAt, revokedAt: null, claimedAt: null, claimedBy: null});
    // The token is printed once; Firestore stores only its hash. Deliver privately.
    console.log(JSON.stringify({id, token,
      steamURL: `steam://run/3996730//?gift=${token}`,
      emailURL: `https://us-central1-${values.project}.cloudfunctions.net/giftLink?token=${token}`,
      localURL: `legion://gift/${token}`,
    }, null, 2));
  } else if (command === 'list') {
    const docs = await gifts.orderBy('createdAt', 'desc').limit(100).get();
    console.log(JSON.stringify(docs.docs.map(doc => ({id: doc.id, ...doc.data()})), null, 2));
  } else {
    if (!values.id || !giftTokenPattern.test(values.id)) throw new Error('Supply --id with the gift ID, not its secret token');
    const ref = gifts.doc(values.id);
    if (command === 'revoke') await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Gift not found');
      if (doc.get('claimedBy')) throw new Error('Already claimed; revoking cannot remove delivered items');
      tx.update(ref, {revokedAt: Date.now()});
    });
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Gift not found');
    console.log(JSON.stringify({id: doc.id, ...doc.data()}, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Gift operation failed');
  process.exitCode = 1;
}
