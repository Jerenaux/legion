export const GAME_RECONNECT_GRACE_MS = 10 * 60 * 1000;

export function shouldRetireGame(
  game: {gameOver: boolean; endedAt: number | null},
  now = Date.now(),
): boolean {
  return game.gameOver && game.endedAt !== null && now - game.endedAt >= GAME_RECONNECT_GRACE_MS;
}
