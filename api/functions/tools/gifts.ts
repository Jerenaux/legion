// Privileged operator CLI. Uses ADC (or FIRESTORE_EMULATOR_HOST), never a public admin endpoint.
import {randomBytes} from 'node:crypto';
import {parseArgs} from 'node:util';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Firestore} from 'firebase-admin/firestore';
import {OAuth2Client} from 'google-auth-library';
import {INVITE_ORIGIN, giftId, giftTokenPattern, isGiftUsage, validateGiftRewards} from '../src/gifts';
import {normalizeCommunityCode} from '@legion/shared/communities';
import {FIRESTORE_DATABASE_ID} from '@legion/shared/config';

const {values, positionals} = parseArgs({args: process.argv.slice(2), allowPositionals: true, options: {
  project: {type: 'string'}, label: {type: 'string'}, rewards: {type: 'string'}, expires: {type: 'string'}, id: {type: 'string'},
  gcloud: {type: 'boolean'}, usage: {type: 'string'}, community: {type: 'string'},
}});
const usage = 'bun tools/gifts.ts <create|list|inspect|revoke> --project PROJECT [--usage single|unlimited --label NAME --rewards FILE.json --expires ISO_DATE --community CODE | --id GIFT_ID]';
try {
  if (!values.project || !['create', 'list', 'inspect', 'revoke'].includes(positionals[0])) throw new Error(usage);
  if (positionals[0] === 'create' && !isGiftUsage(values.usage)) throw new Error('Creation requires --usage single or --usage unlimited');
  const authClient = values.gcloud ? new OAuth2Client() : undefined;
  if (authClient) authClient.setCredentials({
    access_token: execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(),
    expiry_date: Date.now() + 3600000,
  });
  const db = new Firestore({projectId: values.project, databaseId: FIRESTORE_DATABASE_ID, ...(authClient ? {authClient} : {})});
  const gifts = db.collection('creatorGifts');
  const command = positionals[0];
  if (command === 'create') {
    if (!values.label?.trim() || values.label.length > 120 || !values.rewards) throw new Error(usage);
    const rewards = validateGiftRewards(JSON.parse(readFileSync(values.rewards, 'utf8')));
    const expiresAt = values.expires ? Date.parse(values.expires) : null;
    if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())) throw new Error('Expiry must be in the future');
    // Optional: recipients are also invited to join this creator community.
    const communityId = values.community === undefined ? null : normalizeCommunityCode(values.community);
    if (values.community !== undefined) {
      const community = communityId ? await db.collection('communities').doc(communityId).get() : null;
      if (!community?.exists || community.get('status') !== 'active') throw new Error('Community not found or not active');
    }
    const token = randomBytes(32).toString('hex');
    const id = giftId(token);
    await gifts.doc(id).create({usage: values.usage, label: values.label.trim(), rewards, communityId, createdAt: Date.now(), expiresAt, revokedAt: null, claimedAt: null, claimedBy: null});
    // Printed once; keep personal links private and share unlimited links with the intended audience.
    console.log(JSON.stringify({id, token, usage: values.usage, communityId,
      shareURL: `${INVITE_ORIGIN}/invite?gift=${token}`,
      steamURL: `steam://run/3996730/?gift=${token}`,
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
