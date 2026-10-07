// Privileged operator CLI for creator communities. Uses ADC (or FIRESTORE_EMULATOR_HOST) or --gcloud.
import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {FieldValue, Firestore} from 'firebase-admin/firestore';
import {OAuth2Client} from 'google-auth-library';
import {FIRESTORE_DATABASE_ID} from '@legion/shared/config';
import {
  PlayerCommunity, SIGIL_PALETTE, SIGIL_PATTERNS, SIGIL_SHAPES, SIGIL_SYMBOLS, Sigil, communitySummary, normalizeCommunityCode, validateCommunity,
} from '@legion/shared/communities';

const {values, positionals} = parseArgs({args: process.argv.slice(2), allowPositionals: true, options: {
  project: {type: 'string'}, id: {type: 'string'}, name: {type: 'string'}, tag: {type: 'string'}, sigil: {type: 'string'},
  player: {type: 'string'}, gcloud: {type: 'boolean'},
}});
const commands = ['create', 'list', 'inspect', 'set-sigil', 'revoke', 'assign'];
const usage = `bun tools/communities.ts <${commands.join('|')}> --project PROJECT
  create    --id CODE --name NAME --tag TAG [--sigil SHAPE,PATTERN,PALETTE,SYMBOL]
  inspect | revoke --id CODE
  set-sigil --id CODE --sigil SHAPE,PATTERN,PALETTE,SYMBOL
  assign    --id CODE --player UID   (operator override of the permanent membership)
Sigil parts are names or indexes. Shapes: ${SIGIL_SHAPES.join(' ')}; patterns: ${SIGIL_PATTERNS.join(' ')};
palettes: 0-${SIGIL_PALETTE.length - 1}; symbols: ${SIGIL_SYMBOLS.join(' ')}`;

function parseSigil(text: string): Sigil {
  const parts = text.split(',').map(part => part.trim());
  if (parts.length !== 4) throw new Error('Sigil needs 4 parts: SHAPE,PATTERN,PALETTE,SYMBOL');
  const index = (part: string, names: readonly string[]) => /^\d+$/.test(part) ? Number(part) : names.indexOf(part);
  return {shape: index(parts[0], SIGIL_SHAPES), pattern: index(parts[1], SIGIL_PATTERNS),
    palette: Number(parts[2]), symbol: index(parts[3], SIGIL_SYMBOLS)};
}

try {
  const command = positionals[0];
  if (!values.project || !commands.includes(command)) throw new Error(usage);
  const authClient = values.gcloud ? new OAuth2Client() : undefined;
  if (authClient) authClient.setCredentials({
    access_token: execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(),
    expiry_date: Date.now() + 3600000,
  });
  const db = new Firestore({projectId: values.project, databaseId: FIRESTORE_DATABASE_ID, ...(authClient ? {authClient} : {})});
  const communities = db.collection('communities');
  const players = db.collection('players');

  if (command === 'create') {
    const community = validateCommunity({id: values.id, name: values.name, tag: values.tag, sigil: values.sigil ? parseSigil(values.sigil) : undefined});
    await communities.doc(community.id).create({name: community.name, tag: community.tag, sigil: community.sigil,
      status: 'active', members: 0, createdAt: Date.now()});
    console.log(JSON.stringify({...community,
      code: community.id.toUpperCase(),
      linkURL: `https://us-central1-${values.project}.cloudfunctions.net/communityLink?code=${community.id}`,
      steamURL: `steam://run/3996730/?community=${community.id}`,
      localURL: `legion://community/${community.id}`,
    }, null, 2));
  } else if (command === 'list') {
    const docs = await communities.orderBy('createdAt', 'desc').limit(500).get();
    console.log(JSON.stringify(docs.docs.map(doc => ({id: doc.id, ...doc.data()})), null, 2));
  } else {
    const id = normalizeCommunityCode(values.id);
    if (!id) throw new Error('Supply --id with a community code');
    const ref = communities.doc(id);
    const existing = await ref.get();
    if (!existing.exists) throw new Error('Community not found');
    if (command === 'set-sigil') {
      if (!values.sigil) throw new Error(usage);
      const {sigil} = validateCommunity({id, name: existing.get('name'), tag: existing.get('tag'), sigil: parseSigil(values.sigil)});
      await ref.update({sigil});
      // Members carry a copy of the sigil; refresh it everywhere.
      await updateMembers(id, {'community.sigil': sigil});
    } else if (command === 'revoke') {
      await ref.update({status: 'revoked', revokedAt: Date.now()});
      await updateMembers(id, {community: FieldValue.delete()});
      await ref.update({members: 0});
    } else if (command === 'assign') {
      if (!values.player) throw new Error(usage);
      const summary = communitySummary({...existing.data(), id});
      if (!summary || existing.get('status') !== 'active') throw new Error('Community is not active');
      await db.runTransaction(async tx => {
        const playerRef = players.doc(values.player!);
        const player = await tx.get(playerRef);
        if (!player.exists) throw new Error('Player not found');
        const previous = player.get('community.id') as string | undefined;
        if (previous === id) return;
        const membership: PlayerCommunity = {...summary, joinedAt: Date.now(), via: 'operator'};
        tx.update(playerRef, {community: membership});
        tx.update(ref, {members: FieldValue.increment(1)});
        if (previous) tx.update(communities.doc(previous), {members: FieldValue.increment(-1)});
      });
    }
    const doc = await ref.get();
    console.log(JSON.stringify({id: doc.id, ...doc.data()}, null, 2));
  }

  async function updateMembers(id: string, update: Record<string, unknown>) {
    const members = await players.where('community.id', '==', id).get();
    for (let index = 0; index < members.docs.length; index += 400) {
      const batch = db.batch();
      members.docs.slice(index, index + 400).forEach(doc => { batch.update(doc.ref, update); });
      await batch.commit();
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Community operation failed');
  process.exitCode = 1;
}
