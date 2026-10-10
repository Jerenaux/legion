import {communitySummary} from "@legion/shared/communities";
import {ChestColor, League} from "@legion/shared/enums";
import {LeaderboardRow} from "@legion/shared/interfaces";
import {DEMOTION_RATIO, PROMOTION_RATIO} from "@legion/shared/config";

export const LEADERBOARD_LIMIT = 100;

interface RankStats {
  wins: number;
  losses: number;
  rank?: number;
  winStreak: number;
  lossesStreak: number;
  nbGames: number;
  seasonId?: string;
}

export interface RankedPlayer {
  id: string;
  name: string;
  avatar: string;
  elo: number;
  leagueStats: RankStats;
  allTimeStats: RankStats;
  isSynthetic?: boolean;
  community?: unknown;
}

export function currentSeasonId(now = new Date()): string {
  const boundary = new Date(now);
  const daysSinceFriday = (boundary.getUTCDay() + 2) % 7;
  boundary.setUTCDate(boundary.getUTCDate() - daysSinceFriday);
  boundary.setUTCHours(19, 0, 0, 0);
  if (boundary > now) boundary.setUTCDate(boundary.getUTCDate() - 7);
  return boundary.toISOString().slice(0, 10);
}

export function seasonEndingAt(boundary: Date): string {
  const currentSeasonStart = new Date(`${currentSeasonId(boundary)}T19:00:00.000Z`);
  return currentSeasonId(new Date(currentSeasonStart.getTime() - 1));
}

export function getEmptyLeagueStats(rank = 0, seasonId = currentSeasonId()) {
  return {
    rank,
    seasonId,
    wins: 0,
    losses: 0,
    winStreak: 0,
    lossesStreak: 0,
    nbGames: 0,
  };
}

export function applyRankedResult(
  stats: RankStats | undefined,
  isWinner: boolean,
  seasonId: string,
  resetMismatchedSeason: boolean,
): RankStats {
  const reset = resetMismatchedSeason && stats?.seasonId !== seasonId;
  // Older records still carry the retired grade and audience averages; drop them on the next write.
  const {avgGrade: _grade, avgAudienceScore: _audience, ...current} =
    (reset || !stats ? getEmptyLeagueStats(0, seasonId) : stats) as RankStats & {avgGrade?: number; avgAudienceScore?: number};

  return {
    ...current,
    ...(resetMismatchedSeason ? {seasonId} : {}),
    wins: current.wins + (isWinner ? 1 : 0),
    losses: current.losses + (isWinner ? 0 : 1),
    winStreak: isWinner ? current.winStreak + 1 : 0,
    lossesStreak: isWinner ? 0 : current.lossesStreak + 1,
    nbGames: (current.nbGames || 0) + 1,
  };
}

export function rankPlayers(
  players: RankedPlayer[],
  isAllTime: boolean,
  uid?: string,
  league?: League,
  participantCount = players.length,
): LeaderboardRow[] {
  let previousScore = "";
  let rank = 0;
  const promotionCount = Math.min(participantCount, Math.max(Math.ceil(participantCount * PROMOTION_RATIO), 3));
  const demotionCount = Math.floor(participantCount * DEMOTION_RATIO);

  return players.map((player, index) => {
    const stats = isAllTime ? player.allTimeStats : player.leagueStats;
    const score = isAllTime ? `${player.elo}` : `${stats.wins}:${stats.losses}`;
    if (score !== previousScore) rank = index + 1;
    previousScore = score;

    const games = stats.wins + stats.losses;
    const chestColor = !isAllTime && stats.wins > 0 && index < 3 ? [
      ChestColor.GOLD,
      ChestColor.SILVER,
      ChestColor.BRONZE,
    ][index] : null;
    const isPromoted = !isAllTime && league !== undefined && league < League.APEX &&
      stats.wins > 0 && index < promotionCount;
    const isDemoted = !isAllTime && league !== undefined && league > League.BRONZE &&
      !isPromoted && index >= participantCount - demotionCount;

    return {
      rank,
      player: player.name,
      elo: player.elo,
      wins: stats.wins,
      losses: stats.losses,
      winsRatio: `${games ? Math.round((stats.wins / games) * 100) : 0}%`,
      avatar: player.avatar,
      isPlayer: player.id === uid,
      playerId: player.id,
      chestColor,
      isFriend: false,
      isPromoted,
      isDemoted,
      community: communitySummary(player.community),
    };
  });
}
