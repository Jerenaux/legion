const nodemon = require('nodemon');

console.log(`Starting nodemon, Docker mode is ${process.env.IS_DOCKER ? 'enabled' : 'disabled'}`);
const tsConfigFile = process.env.IS_DOCKER ? 'tsconfig.docker.json' : 'tsconfig.json';

nodemon({
  watch: ["src", "shared"],
  ext: "ts",
  exec: `TS_NODE_PROJECT=${tsConfigFile} bun run -r tsconfig-paths/register ./src/server.ts`,
  ignore: ["src/**/*.spec.ts"]
});

nodemon.on('start', function () {
  console.log('App has started');
}).on('quit', function () {
  console.log('App has quit');
  process.exit();
}).on('restart', function (files) {
  // console.log('App restarted due to: ', files);
});
