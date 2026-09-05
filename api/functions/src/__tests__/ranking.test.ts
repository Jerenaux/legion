import { describe, expect, test } from "bun:test";

import { LEADERBOARD_LIMIT, applyRankedResult, currentSeasonId, getLeagueForElo, rankPlayers } from "../ranking";

const player = (id: string, wins: number, losses: number, elo: number, isSynthetic = false) => ({
  id,
  name: id,
  avatar: "1",
  elo,
  isSynthetic,
  leagueStats: {
    wins,
    losses,
    winStreak: 0,
    lossesStreak: 0,
    nbGames: wins + losses,
    avgAudienceScore: 0,
    avgGrade: 0,
  },
  allTimeStats: {
    wins,
    losses,
    winStreak: 0,
    lossesStreak: 0,
    nbGames: wins + losses,
    avgAudienceScore: 0,
    avgGrade: 0,
  },
});

describe("indexed ranking helpers", () => {
  test("keeps a bounded leaderboard", () => {
    expect(LEADERBOARD_LIMIT).toBe(100);
  });

  test("assigns competition ranks and keeps synthetic players", () => {
    const rows = rankPlayers(
      [player("real", 5, 1, 400), player("synthetic", 5, 1, 350, true), player("third", 4, 0, 900)],
      false,
      "real",
    );

    expect(rows.map((row) => [row.playerId, row.rank])).toEqual([
      ["real", 1],
      ["synthetic", 1],
      ["third", 3],
    ]);
    expect(rows[0].isPlayer).toBe(true);
  });

  test("maps elo to stable league thresholds", () => {
    expect(getLeagueForElo(100)).toBe(0);
    expect(getLeagueForElo(300)).toBe(1);
    expect(getLeagueForElo(650)).toBe(2);
    expect(getLeagueForElo(950)).toBe(3);
    expect(getLeagueForElo(1300)).toBe(4);
  });

  test("uses the most recent Friday 19:00 UTC as a weekly season id", () => {
    expect(currentSeasonId(new Date("2026-09-01T12:00:00Z"))).toBe("2026-08-28");
    expect(currentSeasonId(new Date("2026-09-04T20:00:00Z"))).toBe("2026-09-04");
  });

  test("resets stale seasonal stats lazily and retains all-time stats", () => {
    const stale = { ...player("p", 8, 2, 500).leagueStats, seasonId: "2026-08-21" };
    const season = applyRankedResult(stale, true, 100, 4, "2026-08-28", true);
    expect(season).toMatchObject({ wins: 1, losses: 0, nbGames: 1, seasonId: "2026-08-28" });

    const allTime = applyRankedResult(stale, false, 50, 2, "2026-08-28", false);
    expect(allTime).toMatchObject({ wins: 8, losses: 3, nbGames: 11 });
  });
});
