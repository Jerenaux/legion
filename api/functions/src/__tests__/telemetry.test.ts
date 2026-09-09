import {test, expect} from 'bun:test';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import * as Sentry from '@sentry/google-cloud-serverless';
import {onRequest, onSchedule} from '../telemetry';
import {backendTelemetryOptions} from '../../../../shared/telemetry';

test('reports caught HTTP and scheduled failures before completion, preserving deployment metadata and retries', async () => {
  const sent: string[] = [];
  const pending = new Set<Promise<void>>();
  Sentry.init({...backendTelemetryOptions, enabled: true, environment: 'test',
    integrations: [Sentry.captureConsoleIntegration({levels: ['error']})],
    transport: () => ({
      send(envelope) {
        const delivery = new Promise<void>(resolve => setTimeout(() => {sent.push(JSON.stringify(envelope)); resolve();}, 30));
        pending.add(delivery);
        return delivery.then(() => {pending.delete(delivery); return {statusCode: 200};});
      },
      flush: async () => {await Promise.all(pending); return true;},
    }),
  });
  const handler = onRequest({memory: '512MiB', secrets: ['API_KEY']}, (_request, response) => {
    setTimeout(() => {
      console.error(new Error('telemetry-http-caught'));
      response.end('failure handled');
    }, 10); // Same delayed response shape as the existing async CORS handlers.
  });
  const server = createServer((request, response) => handler(request as never, response as never));
  server.listen(0);
  try {
    expect(handler.__endpoint.availableMemoryMb).toBe(512);
    expect(handler.__endpoint.secretEnvironmentVariables).toEqual([{key: 'API_KEY'}]);
    const response = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/test?token=private-query`, {
      headers: {Authorization: 'Bearer private-token', Cookie: 'session=private-cookie'},
    });
    expect(await response.text()).toBe('failure handled');
    expect(sent.some(event => event.includes('telemetry-http-caught'))).toBe(true);
    expect(sent.join()).not.toMatch(/private-query|private-token|private-cookie/);
    const job = onSchedule({schedule: '0 19 * * 5', retryCount: 2}, async () => {throw new Error('telemetry-scheduled');});
    expect(job.__endpoint.scheduleTrigger?.schedule).toBe('0 19 * * 5');
    await expect(job.run({scheduleTime: '2026-09-11T19:00:00Z'})).rejects.toThrow('telemetry-scheduled');
    expect(sent.some(event => event.includes('telemetry-scheduled'))).toBe(true);
  } finally {
    server.closeAllConnections();
    server.close();
    await Sentry.close(2000);
  }
});
