console.log(`Starting nodemon, Docker mode is ${process.env.IS_DOCKER ? 'enabled' : 'disabled'}`);
const tsConfigFile = process.env.IS_DOCKER ? 'tsconfig.docker.json' : 'tsconfig.json';

const { spawn } = require('child_process');

const command = `TS_NODE_PROJECT=${tsConfigFile} npx ts-node -r tsconfig-paths/register ./src/matchmaker.ts`;

const child = spawn(command, { shell: true, stdio: 'inherit' });

child.on('exit', function (code) {
  process.exit(code);
});