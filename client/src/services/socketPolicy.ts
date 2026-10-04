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
