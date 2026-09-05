import { expect, test } from "bun:test";

import { FAKE_QUEUE_NUMBERS_ENABLED } from "../src/matchmaking";

test("keeps fake queue numbers enabled for the desktop release", () => {
  expect(FAKE_QUEUE_NUMBERS_ENABLED).toBe(true);
});
