export const socketReconnectOptions = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
} as const;

export const shouldAbandonGame = (reason: string) => reason === "io server disconnect";
