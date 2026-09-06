import {AIServerPlayer} from "../AIServerPlayer";
import {ServerPlayer} from "../ServerPlayer";

test("getClosestTarget measures distance from the supplied player", () => {
  const ai = new AIServerPlayer(1, "AI", "frame", 0, 0);
  const ally = new ServerPlayer(2, "Ally", "frame", 10, 0);
  const nearAI = new ServerPlayer(3, "Near AI", "frame", 1, 0);
  const nearAlly = new ServerPlayer(4, "Near ally", "frame", 9, 0);

  expect(ai.getClosestTarget([nearAI, nearAlly], ally)).toBe(nearAlly);
});
