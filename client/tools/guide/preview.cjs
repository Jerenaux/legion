// Local-only web preview using the same account/API fixtures as the player guide.
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
process.chdir(path.resolve(__dirname, '../..'));
process.env.NODE_ENV = 'development';
process.env.BUILD_TARGET = 'web';
delete process.env.SENTRY_REPLAY_ENABLED;
delete process.env.SENTRY_AUTH_TOKEN;
const config = require('../../webpack.config');
config.output.path = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-preview-'));
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/providers\/(AuthProvider|PlayerProvider)$/, resource => {
  resource.request = path.join(__dirname, resource.request.endsWith('AuthProvider') ? 'auth.tsx' : 'fixtures.tsx');
}));
config.plugins.push(new webpack.NormalModuleReplacementPlugin(/apiService$/, path.join(__dirname, 'fixtures.tsx')));
const server = new WebpackDevServer({
  host: '127.0.0.1', port: Number(process.env.PORT || 8084),
  historyApiFallback: true, hot: false, liveReload: false, client: false,
  headers: {'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:"},
}, webpack(config));
server.start().catch(error => {console.error(error); process.exitCode = 1;});
