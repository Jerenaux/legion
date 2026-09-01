import {ChestColor, League} from "@legion/shared/enums";
import {LeaderboardRow} from "@legion/shared/interfaces";

export const LEADERBOARD_LIMIT = 100;
export const LEAGUE_ELO_THRESHOLDS = [0, 300, 600, 900, 1200] as const;

interface RankStats {
  wins: number;
  losses: number;
  rank?: number;
  winStreak: number;
  lossesStreak: number;
  nbGames: number;
  avgAudienceScore: number;
  avgGrade: number;
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
}

export function currentSeasonId(now = new Date()): string {
  const boundary = new Date(now);
  const daysSinceFriday = (boundary.getUTCDay() + 2) % 7;
  boundary.setUTCDate(boundary.getUTCDate() - daysSinceFriday);
  boundary.setUTCHours(19, 0, 0, 0);
  if (boundary > now) boundary.setUTCDate(boundary.getUTCDate() - 7);
  return boundary.toISOString().slice(0, 10);
}

export function getLeagueForElo(elo: number): League {
  let league = League.BRONZE;
  LEAGUE_ELO_THRESHOLDS.forEach((threshold, index) => {
    if (elo >= threshold) league = index as League;
  });
  return league;
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
    avgAudienceScore: 0,
    avgGrade: 0,
  };
}

export function applyRankedResult(
  stats: RankStats | undefined,
  isWinner: boolean,
  audienceScore: number,
  grade: number,
  seasonId: string,
  resetMismatchedSeason: boolean,
): RankStats {
  const reset = resetMismatchedSeason && stats?.seasonId !== seasonId;
  const current = reset || !stats ? getEmptyLeagueStats(0, seasonId) : {...stats};
  const games = current.nbGames || 0;

  return {
    ...current,
    ...(resetMismatchedSeason ? {seasonId} : {}),
    wins: current.wins + (isWinner ? 1 : 0),
    losses: current.losses + (isWinner ? 0 : 1),
    winStreak: isWinner ? current.winStreak + 1 : 0,
    lossesStreak: isWinner ? 0 : current.lossesStreak + 1,
    nbGames: games + 1,
    avgAudienceScore: ((current.avgAudienceScore || 0) * games + audienceScore) / (games + 1),
    avgGrade: ((current.avgGrade || 0) * games + grade) / (games + 1),
  };
}

export function rankPlayers(
  players: RankedPlayer[],
  isAllTime: boolean,
  uid?: string,
): LeaderboardRow[] {
  let previousScore = "";
  let rank = 0;

  return players.map((player, index) => {
    const stats = isAllTime ? player.allTimeStats : player.leagueStats;
    const score = isAllTime ? `${player.elo}` : `${stats.wins}:${stats.losses}`;
    if (score !== previousScore) rank = index + 1;
    previousScore = score;

    const games = stats.wins + stats.losses;
    const chestColor = !isAllTime && stats.wins > 0 && rank <= 3 ? [
      ChestColor.GOLD,
      ChestColor.SILVER,
      ChestColor.BRONZE,
    ][rank - 1] : null;

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
      isPromoted: false,
      isDemoted: false,
    };
  });
}
