// Real CDN recorder, intercepted local ingestion only. Never forward fixture data upstream.
const assert = require('node:assert/strict');
const RECORDER_URL = 'https://cdn.logr-in.com/logger-1.min.js';
const INGEST_ORIGIN = 'https://r.logr-in.com';

async function installLogRocketSink(session) {
  const response = await fetch(RECORDER_URL, {signal: AbortSignal.timeout(30000)});
  assert(response.ok, `Could not download the LogRocket recorder: ${response.status}`);
  const recorder = await response.text();
  const uploads = [];
  await session.protocol.handle('https', async request => {
    if (request.url === RECORDER_URL) return new Response(recorder, {headers: {'Content-Type': 'application/javascript'}});
    const url = new URL(request.url);
    if (url.origin === INGEST_ORIGIN) {
      const body = Buffer.from(await request.arrayBuffer());
      if (url.pathname === '/i' && body.length) uploads.push(body);
      return new Response('[]', {headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}});
    }
    return Response.error();
  });
  return {uploads, allows: url => url === RECORDER_URL || new URL(url).origin === INGEST_ORIGIN};
}

module.exports = {installLogRocketSink};
