import {describe, expect, test} from "bun:test";
import type {Firestore} from "firebase-admin/firestore";
import {GameStatus, PlayMode} from "@legion/shared/enums";
import {dailyAnalyticsRange, getDailyAnalytics, recordPlayerActivity} from "../dailyAnalytics";

describe("daily analytics", () => {
  test("defaults to 30 UTC days and rejects malformed, reversed, or excessive ranges", () => {
    expect(dailyAnalyticsRange(undefined, undefined, new Date("2026-09-24T23:00:00Z")))
      .toEqual({startDate: "2026-08-26", endDate: "2026-09-24"});
    expect(dailyAnalyticsRange("2026-09-24", "2026-09-24").startDate).toBe("2026-09-24");
    for (const [start, end] of [
      ["2026-02-30", "2026-03-01"], ["2026-09-25", "2026-09-24"],
      ["2025-01-01", "2026-09-24"], [["2026-09-24"], "2026-09-24"],
      ["2026-09-24", "garbage"], ["", "2026-09-24"],
    ]) expect(() => dailyAnalyticsRange(start, end)).toThrow();
  });

  test("uses bounded aggregate queries, UTC end dates, explicit match modes, and zero-filled days", async () => {
    const data: Record<string, Record<string, unknown>[]> = {
      players: [{joinDate: "2026-09-23 23:59:59"}, {joinDate: "2026-09-24 00:00:00"},
        {joinDate: "2026-09-26 00:00:00"}],
      games: [
        {mode: PlayMode.CASUAL, date: new Date("2026-09-23T23:59:00Z"), end: new Date("2026-09-24T00:01:00Z"), status: GameStatus.COMPLETED},
        {mode: PlayMode.RANKED_VS_AI, date: new Date("2026-09-24T00:00:00Z"), status: GameStatus.ONGOING},
        ...[PlayMode.PRACTICE, PlayMode.TUTORIAL].map(mode => ({mode, date: new Date("2026-09-24T12:00:00Z"), end: new Date("2026-09-24T12:10:00Z"), status: GameStatus.COMPLETED})),
        {mode: PlayMode.CASUAL, date: new Date("2026-09-26T00:00:00Z"), end: new Date("2026-09-26T01:00:00Z"), status: GameStatus.COMPLETED},
      ],
      dailyActiveUsers: [{id: "2026-09-23", users: ["old"]}, {id: "2026-09-24", users: ["a", "b"]}],
    };
    type Filter = [string, string, unknown];
    let aggregates = 0;
    function query(collection: string, filters: Filter[] = []) {
      const matches = () => data[collection].filter(row => filters.every(([field, op, value]) => {
        const actual = row[field] as string;
        if (op === "in") return (value as unknown[]).includes(actual);
        if (op === "==") return actual === value;
        if (op === ">=") return actual >= (value as string);
        if (op === "<=") return actual <= (value as string);
        return actual < (value as string);
      }));
      return {
        // Immutable, like Firestore: ignoring the result must fail this test.
        where: (field: unknown, op: string, value: unknown) => query(collection, [...filters, [typeof field === "string" ? field : "id", op, value]]),
        get: async () => {
          expect(collection).toBe("dailyActiveUsers");
          expect(filters).toHaveLength(2);
          return {docs: matches().map(row => ({id: row.id, data: () => row}))};
        },
        count: () => ({get: async () => {
          expect(filters.some(([, op]) => op === ">=")).toBe(true);
          expect(filters.some(([, op]) => op === "<")).toBe(true);
          aggregates++;
          return {data: () => ({count: matches().length})};
        }}),
      };
    }
    const db = {collection: query} as unknown as Firestore;
    const result = await getDailyAnalytics(db, dailyAnalyticsRange("2026-09-24", "2026-09-25"));
    expect(result.newPlayersPerDay).toEqual({"2026-09-24": 1, "2026-09-25": 0});
    expect(result.matchesCreatedPerDay).toEqual({"2026-09-24": 1, "2026-09-25": 0});
    expect(result.matchesCompletedPerDay).toEqual({"2026-09-24": 1, "2026-09-25": 0});
    expect(result.DAU).toEqual([{date: "2026-09-24", userCount: 2}, {date: "2026-09-25", userCount: 0}]);
    expect(aggregates).toBe(6);
  });

  test("records same-second arrivals once, awaits both writes, and propagates failures", async () => {
    const days = new Map<string, {users: string[]}>();
    let updates = 0;
    let releaseUpdate!: () => void;
    let releaseActivity!: () => void;
    let updateGate = Promise.resolve();
    let activityGate = Promise.resolve();
    const db = {
      collection: () => ({doc: (id: string) => ({id, update: async () => {await updateGate; updates++;}})}),
      runTransaction: async (callback: (transaction: unknown) => Promise<void>) => {
        await activityGate;
        return callback({
          get: async (ref: {id: string}) => ({data: () => days.get(ref.id)}),
          set: (ref: {id: string}, data: {users: string[]}) => days.set(ref.id, data),
        });
      },
    } as unknown as Firestore;
    const now = new Date("2026-09-24T12:00:00Z");
    await recordPlayerActivity(db, "a", "2026-09-24 12:00:00", now);
    await recordPlayerActivity(db, "a", "2026-09-24 12:00:00", now);
    expect(days.get("2026-09-24")?.users).toEqual(["a"]);
    expect(updates).toBe(0);

    updateGate = new Promise(resolve => {releaseUpdate = resolve;});
    activityGate = new Promise(resolve => {releaseActivity = resolve;});
    let finished = false;
    const pending = recordPlayerActivity(db, "b", "old", now).then(() => {finished = true;});
    await Promise.resolve();
    expect(finished).toBe(false);
    releaseUpdate();
    await Promise.resolve();
    expect(finished).toBe(false);
    releaseActivity();
    await pending;
    expect(days.get("2026-09-24")?.users).toEqual(["a", "b"]);
    expect(updates).toBe(1);
    await recordPlayerActivity(db, "a", "old", new Date("2026-09-25T00:00:00Z"));
    expect(days.get("2026-09-25")?.users).toEqual(["a"]);
    const failing = {...db, runTransaction: async () => {throw new Error("write failed");}} as unknown as Firestore;
    await expect(recordPlayerActivity(failing, "a", "2026-09-24 12:00:00", now)).rejects.toThrow("write failed");
  });
});
