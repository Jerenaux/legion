/** Adaptive AI difficulty follows the player's results in their last matches against the AI. */
export const AI_RECENT_MATCHES = 20;

export interface AIStats {
    nbGames: number;
    wins: number;
    /** Last results against the AI, oldest first: 1 for a win, 0 for a loss. */
    recent?: number[];
}

export function recordAIResult(stats: AIStats | undefined, isWinner: boolean): AIStats {
    const current = stats ?? {nbGames: 0, wins: 0};
    return {
        nbGames: current.nbGames + 1,
        wins: current.wins + (isWinner ? 1 : 0),
        recent: [...(current.recent ?? []), isWinner ? 1 : 0].slice(-AI_RECENT_MATCHES),
    };
}

/**
 * Smoothed win rate over the last AI_RECENT_MATCHES matches; 0 for a new player.
 * Matches played before results were recorded count at the player's earlier average.
 */
export function aiWinRatio(stats: AIStats | undefined): number {
    if (!stats || !(stats.nbGames > 0)) return 0;
    const recent = (stats.recent ?? []).slice(-AI_RECENT_MATCHES);
    const recentWins = recent.reduce((sum, result) => sum + result, 0);
    const games = Math.min(stats.nbGames, AI_RECENT_MATCHES);
    const olderGames = stats.nbGames - recent.length;
    const olderRate = olderGames > 0 ? Math.max(0, stats.wins - recentWins) / olderGames : 0;
    const wins = recentWins + Math.max(0, games - recent.length) * olderRate;
    return (wins - 1) / (games + 2);
}
