// Client transport + real HTTP Functions/Firestore; only UI, telemetry and token-provider adapters are replaced.
import {mock} from 'bun:test';
import {strict as assert} from 'node:assert';

export async function checkClientRecovery(api: string, account: {uid: string; token: string}, playerRef) {
  const captured: unknown[] = [];
  const storage = new Map<string, string>();
  const requestIds: string[] = [];
  let loseResponses = true;
  const proxy = Bun.serve({hostname: '127.0.0.1', port: 0, async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/slow-body') return new Response(new ReadableStream({start(controller) {
      controller.enqueue(new TextEncoder().encode('{'));
      setTimeout(() => {try { controller.enqueue(new TextEncoder().encode('}')); controller.close(); } catch {}}, 200);
    }}));
    const body = await request.text();
    requestIds.push(JSON.parse(body).requestId);
    const response = await fetch(`${api}${pathname}`, {method: 'POST', headers: request.headers, body});
    const text = await response.text();
    // Backend has already committed, but its response is lost in transit.
    return loseResponses ? new Response('Proxy lost response', {status: 502}) : new Response(text, {status: response.status});
  }});
  const previousURL = process.env.API_URL;
  process.env.API_URL = proxy.url.origin;
  mock.module('../../client/src/services/firebaseService', () => ({firebaseAuth: {currentUser: {uid: account.uid}}}));
  mock.module('../../client/src/services/firebaseToken', () => ({getTokenWithRetry: async () => account.token}));
  mock.module('../../client/src/telemetry', () => ({captureException: error => captured.push(error)}));
  mock.module('../../client/src/components/utils', () => ({silentErrorToast: () => {}}));
  mock.module('../../client/src/i18n/core', () => ({userError: String}));
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  }});
  try {
    const {apiFetch, apiMutation} = await import('../../client/src/services/apiService');
    await playerRef.update({gold: 100000, 'inventory.consumables': []});
    const body = {articleId: 0, quantity: 1, inventoryType: 0};
    await assert.rejects(apiMutation('purchaseItem', body));
    assert.equal(storage.size, 1, 'Ambiguous result retains durable retry identity');
    assert.equal(captured.length, 1, 'Only exhausted operation is reported');
    assert.equal((await playerRef.get()).data().inventory.consumables.length, 1);
    loseResponses = false;
    await apiMutation('purchaseItem', body);
    assert.equal(new Set(requestIds).size, 1, 'Manual retry reuses the persisted request ID');
    assert.equal(storage.size, 0);
    assert.equal((await playerRef.get()).data().inventory.consumables.length, 1, 'Lost responses cannot duplicate purchase');
    await apiMutation('purchaseItem', body);
    assert.equal((await playerRef.get()).data().inventory.consumables.length, 2, 'A subsequent intentional purchase receives a fresh ID');
    await playerRef.update({gold: 0});
    const before = requestIds.length;
    await assert.rejects(apiMutation('purchaseItem', body));
    assert.equal(requestIds.length, before + 1, 'Expected rejection must not retry');
    assert.equal(captured.length, 1, 'Expected rejection is not a Sentry error');
    await assert.rejects(apiFetch('slow-body', {timeoutMs: 25}));
    assert.equal(captured.length, 2, 'Body timeout is reported once');
    console.log('Real client transport: lost-response recovery, durable receipts, expected rejection, and body timeout pass');
  } finally {
    proxy.stop(true);
    process.env.API_URL = previousURL;
    mock.restore();
  }
}
