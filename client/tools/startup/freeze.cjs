// Real Electron main-thread ANR + production diagnostics, with loopback-only ingestion.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {app, powerMonitor} = require('electron');
const Sentry = require('@sentry/electron/main');
const {parseEnvelope} = require('@sentry/core');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'emberhall-freeze-'));
app.setPath('userData', profile);
const events = [];
const sink = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    events.push(...parseEnvelope(new Uint8Array(request.headers['content-encoding'] === 'gzip' ? require('node:zlib').gunzipSync(Buffer.concat(chunks)) : Buffer.concat(chunks)))[1].filter(([header]) => header.type === 'event').map(([, event]) => event));
  } catch {}
  response.writeHead(200).end('{}');
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = setTimeout(() => { console.error('Main ANR smoke timed out'); app.exit(1); }, 45000);
sink.listen(0, '127.0.0.1', async () => {
  try {
    const original = Sentry.init;
    Sentry.init = options => original({...options, dsn: `http://test@127.0.0.1:${sink.address().port}/1`, environment: 'test'});
    process.env.NODE_ENV = 'production';
    require('../../electron/telemetry').initializeTelemetry(app);
    Sentry.init = original;
    await app.whenReady();
    await delay(1500);
    powerMonitor.emit('lock-screen');
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
    assert.equal(Sentry.getIsolationScope().getScopeData().contexts.desktop_health.locked, true);
    powerMonitor.emit('unlock-screen');
    await delay(2000);
    const until = Date.now() + 12000;
    while (Date.now() < until) { /* Deliberately stall the real main thread. */ }
    for (let i = 0; i < 100 && !events.some(event => event.exception?.values?.some(value => value.type === 'ApplicationNotResponding')); i++) await delay(100);
    const event = events.find(event => event.exception?.values?.some(value => value.type === 'ApplicationNotResponding'));
    assert(event, 'Main-thread ANR must reach loopback ingestion');
    assert.equal(event.tags['event.process'], 'browser');
    assert.equal(event.contexts.desktop_health.power_event, 'unlock-screen');
    assert.equal(event.contexts.desktop_health.suspended, false);
    assert.equal(event.contexts.desktop_health.locked, false);
    assert(event.contexts.desktop_health.main_rss_mb > 0);
    assert(event.contexts.desktop_health.recent_timer_delays_ms.length <= 6);
    assert(event.exception.values.some(value => value.stacktrace?.frames?.length), 'Main-thread ANR must contain frames');
    assert(event.breadcrumbs.some(crumb => crumb.category === 'desktop.power'));
    console.log('Real main-thread freeze reports stack, power history, and bounded health context');
    await Sentry.close(2000);
    clearTimeout(timeout);
    sink.closeAllConnections();
    sink.close();
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
app.on('will-quit', () => fs.rmSync(profile, {recursive: true, force: true}));
