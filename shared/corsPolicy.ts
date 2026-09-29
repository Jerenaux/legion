import type {IncomingMessage, ServerResponse} from 'node:http';

const allowedOrigins = [process.env.CLIENT_ORIGIN, 'app://legion', 'http://localhost:8080'].filter(Boolean);
const isAllowedOrigin = (origin: string | undefined) => !origin || allowedOrigins.includes(origin);

export const desktopCors = {
  origin: (origin: string | undefined, done: (error: Error | null, allowed: boolean) => void) =>
    done(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST'],
  credentials: true,
};

// Used by HTTP routes and Engine.IO, including direct WebSocket handshakes.
// Expected rejections are responses, not exceptions captured as server failures.
export function rejectUntrustedOrigin(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (!isAllowedOrigin(request.headers.origin)) {
    response.writeHead(403, {'Content-Type': 'text/plain'});
    response.end('Origin not allowed');
    return;
  }
  next();
}

export function rejectSocketOrigin(request: IncomingMessage, response: ServerResponse, next: (error?: Error) => void) {
  // Engine.IO's upgrade response cannot write an HTTP response. Its callback rejects
  // cleanly, including upgrades of existing sessions (which bypass allowRequest).
  if (request.headers.upgrade?.toLowerCase() === 'websocket' && !isAllowedOrigin(request.headers.origin)) {
    next(new Error('Origin not allowed'));
    return;
  }
  rejectUntrustedOrigin(request, response, next);
}
