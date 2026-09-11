// Real CDN recorder, local ingestion by default. --logrocket-live sends synthetic fixtures only.
const assert = require('node:assert/strict');
const RECORDER_URL = 'https://cdn.lrkt-in.com/logger-1.min.js';
const INGEST_ORIGIN = 'https://r.lrkt-in.com';

async function installLogRocketSink(session, live = false) {
  assert(!live || !process.env.CI, 'CI must never send LogRocket recordings to production');
  const response = await fetch(RECORDER_URL, {signal: AbortSignal.timeout(30000)});
  assert(response.ok, `Could not download the LogRocket recorder: ${response.status}`);
  const recorder = await response.text();
  const uploads = [];
  const failures = [];
  const accepted = [];
  await session.protocol.handle('https', async request => {
    if (request.url === RECORDER_URL) return new Response(recorder, {headers: {'Content-Type': 'application/javascript'}});
    const url = new URL(request.url);
    if (url.origin === INGEST_ORIGIN) {
      const body = Buffer.from(await request.arrayBuffer());
      if (url.pathname === '/i' && body.length) uploads.push(body);
      if (live) {
        try {
          const upstream = await require('electron').net.fetch(request.url, {
            method: request.method, headers: request.headers, body: body.length ? body : undefined,
            bypassCustomProtocolHandlers: true, signal: AbortSignal.timeout(30000),
          });
          const result = await upstream.text();
          if (!upstream.ok) failures.push(`LogRocket rejected the verification session: ${upstream.status}`);
          if (result.startsWith('[')) {
            const messages = JSON.parse(result);
            if (messages.some(message => /QUOTA_EXCEEDED|BLOCK_RECORDING/.test(message.type))) failures.push('LogRocket account is not accepting recordings');
            console.log('LogRocket verification response:', messages.map(message => message.type));
          }
          if (upstream.ok && url.pathname === '/i' && body.length) accepted.push(body);
          return new Response(result, {status: upstream.status, headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}});
        } catch (error) {
          failures.push(`LogRocket verification transport failed: ${error.name}`);
          return Response.error();
        }
      }
      return new Response('[]', {headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}});
    }
    return Response.error();
  });
  return {uploads, accepted, failures, allows: url => url === RECORDER_URL || new URL(url).origin === INGEST_ORIGIN};
}

module.exports = {installLogRocketSink};
