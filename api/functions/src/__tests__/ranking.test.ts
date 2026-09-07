import {describe, expect, test} from "bun:test";

import {ChestColor, League} from "@legion/shared/enums";

import {
  LEADERBOARD_LIMIT,
  applyRankedResult,
  currentSeasonId,
  rankPlayers,
  seasonEndingAt,
} from "../ranking";

const player = (
  id: string,
  wins: number,
  losses: number,
  elo: number,
  isSynthetic = false,
) => ({
  id,
  name: id,
  avatar: "1",
  elo,
  isSynthetic,
  leagueStats: {wins, losses, winStreak: 0, lossesStreak: 0, nbGames: wins + losses, avgAudienceScore: 0, avgGrade: 0},
  allTimeStats: {wins, losses, winStreak: 0, lossesStreak: 0, nbGames: wins + losses, avgAudienceScore: 0, avgGrade: 0},
});

describe("indexed ranking helpers", () => {
  test("keeps a bounded leaderboard", () => {
    expect(LEADERBOARD_LIMIT).toBe(100);
  });

  test("assigns competition ranks and keeps synthetic players", () => {
    const rows = rankPlayers([
      player("real", 5, 1, 400),
      player("synthetic", 5, 1, 350, true),
      player("third", 4, 0, 900),
    ], false, "real");

    expect(rows.map((row) => [row.playerId, row.rank])).toEqual([
      ["real", 1],
      ["synthetic", 1],
      ["third", 3],
    ]);
    expect(rows[0].isPlayer).toBe(true);
  });

  test("uses the most recent Friday 19:00 UTC as a weekly season id", () => {
    expect(currentSeasonId(new Date("2026-09-01T12:00:00Z"))).toBe("2026-08-28");
    expect(currentSeasonId(new Date("2026-09-04T20:00:00Z"))).toBe("2026-09-04");
    expect(seasonEndingAt(new Date("2026-09-04T19:00:00Z"))).toBe("2026-08-28");
    expect(seasonEndingAt(new Date("2026-09-07T12:00:00Z"))).toBe("2026-08-28");
  });

  test("marks the old weekly promotion, demotion, and podium outcomes", () => {
    const players = Array.from({length: 10}, (_, index) =>
      player(`p${index + 1}`, 20 - index, index, 1000 - index),
    );
    const rows = rankPlayers(players, false, undefined, League.SILVER, players.length);

    expect(rows.filter((row) => row.isPromoted).map((row) => row.playerId))
      .toEqual(["p1", "p2", "p3", "p4"]);
    expect(rows.filter((row) => row.isDemoted).map((row) => row.playerId))
      .toEqual(["p8", "p9", "p10"]);
    expect(rows.slice(0, 4).map((row) => row.chestColor))
      .toEqual([ChestColor.GOLD, ChestColor.SILVER, ChestColor.BRONZE, null]);
  });

  test("keeps the lowest and highest leagues bounded", () => {
    const players = [player("first", 2, 0, 200), player("second", 1, 1, 100)];
    expect(rankPlayers(players, false, undefined, League.BRONZE, players.length)
      .some((row) => row.isDemoted)).toBe(false);
    expect(rankPlayers(players, false, undefined, League.APEX, players.length)
      .some((row) => row.isPromoted)).toBe(false);
  });

  test("resets stale seasonal stats lazily and retains all-time stats", () => {
    const stale = {...player("p", 8, 2, 500).leagueStats, seasonId: "2026-08-21"};
    const season = applyRankedResult(stale, true, 100, 4, "2026-08-28", true);
    expect(season).toMatchObject({wins: 1, losses: 0, nbGames: 1, seasonId: "2026-08-28"});

    const allTime = applyRankedResult(stale, false, 50, 2, "2026-08-28", false);
    expect(allTime).toMatchObject({wins: 8, losses: 3, nbGames: 11});
  });
});
