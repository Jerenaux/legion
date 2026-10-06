import {telemetryConfig} from '../telemetryConfig';

export const socketReconnectOptions = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
} as const;

export const createRefreshingSocketAuth = (
  getToken: () => Promise<string>,
  payload: Record<string, unknown> = {},
) => (callback: (auth: Record<string, unknown>) => void) => {
  void getToken()
    .then(token => callback({...payload, token, storeBuild: telemetryConfig.sentryReplay}))
    .catch(() => callback({...payload, token: "", storeBuild: telemetryConfig.sentryReplay}));
};

export const shouldAbandonGame = (reason: string) => reason === "io server disconnect";

// One forced refresh after a rejected token; transport failures keep normal backoff.
const refreshedSockets = new WeakSet<object>();
export function retrySocketAuthentication(
  socket: {connect: () => unknown; once?: (event: string, callback: () => void) => unknown},
  error: Error,
  getToken: (force?: boolean) => Promise<string>,
  stillWanted: () => boolean = () => true,
) {
  if (error.message !== 'Authentication failed' || refreshedSockets.has(socket)) return false;
  refreshedSockets.add(socket);
  socket.once?.('connect', () => refreshedSockets.delete(socket));
  // The refresh is asynchronous: never reopen a socket the game closed in the meantime.
  const reconnect = () => { if (stillWanted()) socket.connect(); };
  void getToken(true).then(reconnect, reconnect);
  return true;
}
