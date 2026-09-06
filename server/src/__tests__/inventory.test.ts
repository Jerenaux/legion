import {hasMinLevel} from "@legion/shared/inventory";
import {APICharacterData} from "@legion/shared/interfaces";

test("hasMinLevel enforces character level requirements", () => {
  const character = {level: 3} as APICharacterData;

  expect(hasMinLevel(character, 3)).toBe(true);
  expect(hasMinLevel(character, 4)).toBe(false);
});
