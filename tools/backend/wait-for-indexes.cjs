const {setTimeout: delay} = require('node:timers/promises');
const specifications = require('../../firestore.indexes.json').indexes.filter(index =>
  index.collectionGroup === 'players' && index.fields.some(field => field.fieldPath === 'elo')
  && index.fields.some(field => field.fieldPath === 'lastActiveDate'));
const key = fields => JSON.stringify(fields.filter(field => field.fieldPath !== '__name__').map(field => [field.fieldPath, field.order]));

async function waitForIndexes(list, pause = () => delay(10_000), attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const indexes = await list();
    const required = specifications.map(spec => indexes.find(index => index.queryScope === 'COLLECTION' && key(index.fields) === key(spec.fields)));
    if (required.some(index => index && ['NEEDS_REPAIR', 3].includes(index.state))) throw new Error('An opponent index needs repair');
    if (required.every(index => index && ['READY', 2].includes(index.state))) return;
    console.log('Waiting for opponent indexes to become ready');
    if (attempt + 1 < attempts) await pause();
  }
  throw new Error('Opponent indexes are not ready; Functions deployment stopped');
}
module.exports = {waitForIndexes, specifications};
if (require.main === module) {
  const {FirestoreAdminClient} = require('../../api/functions/node_modules/@google-cloud/firestore').v1;
  const client = new FirestoreAdminClient();
  const project = process.argv[2];
  if (!project) throw new Error('Project ID required');
  waitForIndexes(async () => {
    const [indexes] = await client.listIndexes({parent: `projects/${project}/databases/(default)/collectionGroups/players`});
    return indexes;
  }).catch(error => {console.error(error); process.exitCode = 1;}).finally(() => client.close());
}
