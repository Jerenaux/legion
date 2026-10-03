// Headless dev server with local providers. Not imported by release builds.
// Start server/tools/practice-preview.ts separately, then run this script from client.
const path = require('node:path');
const client = path.resolve(__dirname, '../..');
process.chdir(client);
process.env.API_URL = 'http://127.0.0.1:8093';
process.env.GAME_SERVER_URL = 'http://127.0.0.1:8093';
process.env.MATCHMAKER_URL = 'http://127.0.0.1:8093';
process.env.SENTRY_REPLAY_ENABLED = '';
delete process.env.SENTRY_AUTH_TOKEN;
const webpack = require('webpack');
const Server = require('webpack-dev-server');
const config = require('../../webpack.config');
config.context = client;
config.watchOptions = {poll: 1000, ignored: /node_modules/};
const fixtures = path.join(client, 'tools/guide');
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/providers\/(AuthProvider|PlayerProvider)$/, resource => {
  resource.request = path.join(fixtures, resource.request.endsWith('AuthProvider') ? 'auth.tsx' : 'fixtures.tsx');
}));
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/apiService$/, path.join(fixtures, 'fixtures.tsx')));
const port = 8082;
// Prevent the preview from contacting production telemetry, auth, or backend services.
new Server({...config.devServer, host: '127.0.0.1', port, open: false, allowedHosts: ['host.docker.internal'],
  proxy: [{context: ['/socket.io'], target: 'http://127.0.0.1:8093', ws: true}],
  headers: {...config.devServer.headers, 'Content-Security-Policy': "connect-src 'self' http://127.0.0.1:8093 ws://127.0.0.1:* ws://host.docker.internal:8082"},
}, webpack(config)).start();
