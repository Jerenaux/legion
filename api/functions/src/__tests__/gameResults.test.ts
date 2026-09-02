import {describe, expect, test} from "bun:test";
import {gameResultReceiptId} from "../gameResults";

describe("game result receipts", () => {
  test("uses both the game run and player without exposing either in a document id", () => {
    expect(gameResultReceiptId("game:123", "player-a")).toHaveLength(64);
    expect(gameResultReceiptId("game:123", "player-a")).toBe(gameResultReceiptId("game:123", "player-a"));
    expect(gameResultReceiptId("game:123", "player-a")).not.toBe(gameResultReceiptId("game:123", "player-b"));
  });
});
