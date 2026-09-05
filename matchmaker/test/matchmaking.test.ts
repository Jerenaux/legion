import { expect, test } from "bun:test";

import { isQueueMode, parseQueueMode, runMatchmakingPass, tryMatchPlayers } from "../src/matchmaking";

const player = (id: string) => ({
  socket: { id, uid: id },
  elo: 1000,
  range: 100,
  mode: 4,
  waitingTime: 0,
  gold: 0,
});

test("serializes matchmaking and removes only successful matches", async () => {
  const queue = [player("one"), player("two")];
  let attempts = 0;
  let finishGame: (success: boolean) => void;
  const slowGame = () =>
    new Promise<boolean>((resolve) => {
      attempts++;
      finishGame = resolve;
    });

  const firstPass = runMatchmakingPass(() => tryMatchPlayers(queue, slowGame));
  expect(attempts).toBe(1);
  expect(await runMatchmakingPass(() => tryMatchPlayers(queue, slowGame))).toBe(false);

  finishGame!(false);
  expect(await firstPass).toBe(true);
  expect(attempts).toBe(1);
  expect(queue).toHaveLength(2);

  const removed: typeof queue = [];
  await runMatchmakingPass(() =>
    tryMatchPlayers(
      queue,
      async () => true,
      (matchedPlayer) => {
        removed.push(matchedPlayer);
        queue.splice(queue.indexOf(matchedPlayer), 1);
      },
    ),
  );

  expect(removed).toEqual([
    expect.objectContaining({ socket: expect.objectContaining({ id: "two" }) }),
    expect.objectContaining({ socket: expect.objectContaining({ id: "one" }) }),
  ]);
  expect(queue).toHaveLength(0);
});

test("accepts only supported public queue modes", () => {
  expect(isQueueMode(0)).toBe(true);
  expect(isQueueMode(2)).toBe(true);
  expect(isQueueMode(5)).toBe(true);
  expect(isQueueMode(7)).toBe(false);
  expect(isQueueMode("2")).toBe(false);
  expect(parseQueueMode("2")).toBe(2);
  expect(parseQueueMode("7")).toBeNull();
  expect(parseQueueMode(5)).toBe(5);
});
