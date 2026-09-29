import {test, expect} from 'bun:test';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import express from 'express';
import cors from 'cors';
import {Server} from 'socket.io';
import {desktopCors, rejectSocketOrigin, rejectUntrustedOrigin} from '../../../shared/corsPolicy';

test('HTTP and Socket.IO allow desktop/local clients and reject foreign origins without throwing', async () => {
  const app = express();
  app.use(rejectUntrustedOrigin, cors(desktopCors));
  app.get('/', (_req, res) => res.send('healthy'));
  const server = createServer(app);
  const io = new Server(server, {cors: desktopCors});
  io.engine.use(rejectSocketOrigin);
  server.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const origin of [undefined, 'app://legion', 'http://localhost:8080', 'https://www.play-legion.io', 'https://evil.example', 'null']) {
      const allowed = !origin || ['app://legion', 'http://localhost:8080'].includes(origin);
      for (const route of ['/', '/socket.io/?EIO=4&transport=polling']) {
        for (const method of ['GET', 'OPTIONS']) {
          const response = await fetch(url + route, {method, headers: origin ? {Origin: origin} : {}});
          expect(response.status).toBe(allowed ? (method === 'OPTIONS' ? 204 : 200) : 403);
          if (origin && allowed) expect(response.headers.get('access-control-allow-origin')).toBe(origin);
          if (!allowed) {
            expect(response.headers.get('access-control-allow-origin')).toBeNull();
            expect(await response.text()).toBe('Origin not allowed');
          }
        }
      }
    }
    const handshake = await (await fetch(url + '/socket.io/?EIO=4&transport=polling', {headers: {Origin: 'app://legion'}})).text();
    const {sid} = JSON.parse(handshake.slice(1));
    for (const suffix of ['', `&sid=${sid}`]) {
      const upgrade = await fetch(url + '/socket.io/?EIO=4&transport=websocket' + suffix, {
        headers: {Origin: 'https://evil.example', Connection: 'Upgrade', Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='},
      });
      // Engine.IO uses 400 for rejected HTTP upgrades, including existing sessions.
      expect(upgrade.status).toBe(400);
      expect(await upgrade.text()).toBe('Bad request');
    }
  } finally {io.close(); server.closeAllConnections(); server.close();}
});
