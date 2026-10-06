// Isolated integration suite: no production endpoints, credentials, or player data.
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '../..');
const logs = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-backend-'));
const children = [];
const secretPath = path.join(root, 'api/functions/.secret.local');
let previousSecrets;
let secretsWritten = false;
const env = {...process.env, NODE_ENV:'development', API_KEY:'local-backend-test',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099', FIRESTORE_EMULATOR_HOST:'127.0.0.1:18090',
  API_URL:'http://127.0.0.1:15001/legion-32c6d/us-central1', GAME_SERVER_URL:'http://127.0.0.1:13123'};
delete env.SENTRY_AUTH_TOKEN;
if (env.JAVA_HOME) env.PATH = path.join(env.JAVA_HOME,'bin') + path.delimiter + env.PATH;
function start(name, executable, args, cwd=root, extra={}) {
  const log = path.join(logs, name+'.log');
  const fd = fs.openSync(log, 'w');
  const child=spawn(executable,args,{cwd,env:{...env,...extra},stdio:['ignore',fd,fd],detached:process.platform!=='win32'});
  fs.closeSync(fd);children.push(child);
  child.done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${name} failed (${code}); see ${log}`)));});
  child.done.catch(()=>{});
  return child;
}
async function waitFor(check, child) {
  for(let i=0;i<240;i++) {
    if(child.exitCode!==null) await child.done;
    if(await check()) return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`Service did not become ready; logs: ${logs}`);
}
async function portFree(port) {
  await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});
}
async function healthy(url) {try {return (await fetch(url)).ok;} catch {return false;}}
async function stop() {
  for(const child of [...children].reverse()) if(child.exitCode===null && child.signalCode===null) {
    try {process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGINT');} catch {}
  }
  await Promise.race([Promise.allSettled(children.map(child=>child.done)),new Promise(resolve=>setTimeout(resolve,5000))]);
  for(const child of children) if(child.exitCode===null && child.signalCode===null) {try {process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');} catch {}}
  if(secretsWritten) previousSecrets===undefined?fs.rmSync(secretPath,{force:true}):fs.writeFileSync(secretPath,previousSecrets);
  stopStrayEmulators();
}
// firebase-tools starts the Java emulators in their own process group, so the group kill above
// can miss them. Stop any Firebase emulator still listening on this runner's ports, and nothing else.
function stopStrayEmulators() {
  if(process.platform==='win32') return;
  const {execFileSync}=require('node:child_process');
  for(const port of [18090,9150,19099,15001,14400,14500]) {
    let pids=[];
    try {pids=execFileSync('lsof',['-t',`-iTCP:${port}`,'-sTCP:LISTEN'],{encoding:'utf8'}).split('\n').filter(Boolean);} catch {continue;}
    for(const pid of pids) {
      try {
        const command=execFileSync('ps',['-o','command=','-p',pid],{encoding:'utf8'});
        if(/firebase|emulator/i.test(command)) process.kill(Number(pid),'SIGKILL');
      } catch {}
    }
  }
}
async function main() {
  for(const port of [19099,18090,15001,14400,14500,13123,13000,9150]) await portFree(port);
  if(fs.existsSync(secretPath)) previousSecrets=fs.readFileSync(secretPath);
  fs.writeFileSync(secretPath,'API_KEY=local-backend-test\nSTEAM_WEB_API_KEY=local-backend-test\n');secretsWritten=true;
  await start('build','bun',['run','build'],path.join(root,'api/functions'),{DEPLOY:'true'}).done;
  const emulators=start('emulators',process.execPath,['api/functions/node_modules/firebase-tools/lib/bin/firebase.js','emulators:start','--config','firebase.emulators.json','--project','legion-32c6d','--only','auth,firestore,functions']);
  await waitFor(()=>fs.readFileSync(path.join(logs,'emulators.log'),'utf8').includes('All emulators ready'),emulators);
  const server=start('server','bun',['src/server.ts'],path.join(root,'server'),{PORT:'13123'});
  const matchmaker=start('matchmaker','bun',['src/matchmaker.ts'],path.join(root,'matchmaker'),{PORT:'13000'});
  await Promise.all([waitFor(()=>healthy(env.GAME_SERVER_URL),server),waitFor(()=>healthy('http://127.0.0.1:13000'),matchmaker)]);
  await start('benchmark','bun',['../../tools/backend/benchmark.ts','optimized'],path.join(root,'api/functions')).done;
  await start('integration','bun',['../../tools/backend/smoke.ts'],path.join(root,'api/functions')).done;
  console.log(fs.readFileSync(path.join(logs,'benchmark.log'),'utf8'));
  console.log(fs.readFileSync(path.join(logs,'integration.log'),'utf8'));
}
let interrupted=false;
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{interrupted=true;await stop();process.exit(130);});
main().catch(error=>{if(!interrupted)console.error(error);process.exitCode=1;}).finally(async()=>{await stop();console.log(`Local backend logs: ${logs}`);});
