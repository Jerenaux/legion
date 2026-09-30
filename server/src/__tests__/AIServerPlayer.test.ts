import {AIServerPlayer} from "../AIServerPlayer";
import {ServerPlayer} from "../ServerPlayer";
import {expect, mock, spyOn, test} from "bun:test";
import {Server} from "socket.io";
import {League, PlayMode} from "@legion/shared/enums";
import {getSpellById} from "@legion/shared/Spells";
import {Game} from "../Game";
import {Spell} from "../Spell";

class TestGame extends Game {
  populateTeams() {}
}

test("getClosestTarget measures distance from the supplied player", () => {
  const ai = new AIServerPlayer(1, "AI", "frame", 0, 0);
  const ally = new ServerPlayer(2, "Ally", "frame", 10, 0);
  const nearAI = new ServerPlayer(3, "Near AI", "frame", 1, 0);
  const nearAlly = new ServerPlayer(4, "Near ally", "frame", 9, 0);

  expect(ai.getClosestTarget([nearAI, nearAlly], ally)).toBe(nearAlly);
});

test("AI casts basic area spells only when a living enemy is reachable", () => {
  const game = new TestGame("ai-spell-targeting", PlayMode.PRACTICE, League.BRONZE, {} as Server);
  const ai = new AIServerPlayer(1, "Mage", "frame", 1, 5);
  const enemy = new ServerPlayer(1, "Enemy", "frame", 14, 5);
  ai.setHP(100);
  enemy.setHP(100);
  game.teams.get(1)!.addMember(ai);
  game.teams.get(2)!.addMember(enemy);
  const cast = spyOn(game, "processMagic").mockImplementation(() => undefined);
  spyOn(Math, "random").mockReturnValue(0.5); // Allow the AI to consider casting.
  try {
    for (const spellId of [0, 3, 6]) {
      ai.spells = [new Spell(getSpellById(spellId))];
      enemy.x = 14;
      enemy.hp = 100;
      cast.mockClear();
      expect(ai.checkForAoE(0)).toBe(false);
      expect(cast).not.toHaveBeenCalled();

      enemy.x = 3;
      expect(ai.checkForAoE(0)).toBe(true);
      expect(cast).toHaveBeenCalledWith({x: 3, y: 5, index: 0, targetTeam: null, target: null});

      enemy.hp = 0;
      cast.mockClear();
      expect(ai.checkForAoE(0)).toBe(false);
      expect(cast).not.toHaveBeenCalled();
    }
  } finally {
    mock.restore();
  }
});

test("AI can center a larger blast on empty ground when it hits enemies", () => {
  const game = new TestGame("ai-area-targeting", PlayMode.PRACTICE, League.BRONZE, {} as Server);
  const ai = new AIServerPlayer(1, "Mage", "frame", 3, 5);
  ai.setHP(100);
  game.teams.get(1)!.addMember(ai);
  expect(game.scanGridForAoE(ai, 1, 0)).toBeNull();

  const enemies = game.teams.get(2)!;
  for (const x of [8, 10]) {
    const enemy = new ServerPlayer(x, "Enemy", "frame", x, 5);
    enemy.setHP(100);
    enemies.addMember(enemy);
  }
  const tile = game.scanGridForAoE(ai, 1, 1)!;
  expect(tile).not.toBeNull();
  expect(enemies.getMembers().some(enemy => enemy.x === tile.x && enemy.y === tile.y)).toBe(false);
  expect(game.nbPlayersInArea(enemies, tile.x, tile.y, 1)).toBe(2);
});
