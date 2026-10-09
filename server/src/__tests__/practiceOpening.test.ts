import {expect, test} from 'bun:test';
import type {Server} from 'socket.io';
import {Class, League, PlayMode, SpeedClass, Stat} from '@legion/shared/enums';
import {NewCharacter} from '@legion/shared/NewCharacter';
import {hexDistance, isInSpellRange} from '@legion/shared/utils';
import type {CharacterData} from '@legion/shared/interfaces';
import {AIGame} from '../AIGame';
import {TurnSystem} from '../TurnSystem';

class PracticeGame extends AIGame {
    protected async getRosterData() {
        return {characters: [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].map(kind =>
            new NewCharacter(kind, 1, false).getCharacterData()) as CharacterData[]};
    }
}

test('first practice opens warrior, offensive mage, healer with reachable enemies; later games keep speed order', async () => {
    const game = new PracticeGame('opening-test', PlayMode.PRACTICE, League.BRONZE, {} as Server);
    game.generateHoles();
    await game.populateTeams();
    const characters = game.getTeam(1).concat(game.getTeam(2));
    expect(new Set(characters.map(p => `${p.x},${p.y}`)).size).toBe(characters.length);
    for (const player of characters) expect(game.isHole(player.x, player.y)).toBe(false);
    for (const player of game.getTeam(1)) {
        expect(game.getTeam(2).every(enemy => isInSpellRange(player.x, player.y, enemy.x, enemy.y))).toBe(true);
        // Leave room for movement without immediately losing every spell target.
        expect(Math.min(...game.getTeam(2).map(enemy => hexDistance(player.x, player.y, enemy.x, enemy.y)))).toBeLessThanOrEqual(4);
    }
    for (const action of [SpeedClass.PASS, SpeedClass.FAST, SpeedClass.NORMAL, SpeedClass.SLOW]) {
        const turns = new TurnSystem();
        turns.initializeTurnOrder(characters, game.getOpeningTurnOrder());
        for (const kind of [Class.WARRIOR, Class.BLACK_MAGE, Class.WHITE_MAGE]) {
            const player = turns.getNextActor();
            expect(player.team.id).toBe(1);
            expect(player.class).toBe(kind);
            turns.processAction(player, action);
        }
        expect(turns.getNextActor().team.id).toBe(2);
    }
    game.teams.get(1)!.teamData.completedGames = 1;
    expect(game.getOpeningTurnOrder()).toBeUndefined();
    const turns = new TurnSystem();
    turns.initializeTurnOrder(characters, game.getOpeningTurnOrder());
    expect(turns.getNextActor().getStat(Stat.SPEED)).toBe(Math.max(...characters.map(p => p.getStat(Stat.SPEED))));
    game.teams.get(1)!.teamData.completedGames = 0;
    game.mode = PlayMode.CASUAL_VS_AI;
    expect(game.getOpeningTurnOrder()).toBeUndefined();
});


test('AI loadouts respect spell levels when generated, copied and regenerated', async () => {
    const game = new PracticeGame('spell-level-test', PlayMode.PRACTICE, League.BRONZE, {} as Server);
    game.generateHoles();
    await game.populateTeams();
    const team = game.teams.get(2)!;
    for (const character of team.getMembers()) {
        for (const spell of character.spells) expect(spell.minLevel).toBeLessThanOrEqual(character.level);
    }
    const data = new NewCharacter(Class.BLACK_MAGE, 1).getCharacterData();
    data.skills = [0, 2];
    const copied = game.addAICharacter(team, data);
    expect(copied.spells.map(spell => spell.id)).toEqual([0]);
    copied.spell_slots = 20;
    team.setZombieSpells();
    expect(copied.spells.some(spell => spell.id === 2)).toBe(false);
    for (const spell of copied.spells) expect(spell.minLevel).toBeLessThanOrEqual(copied.level);
    copied.zombieLevelUp(20);
    team.setZombieSpells();
    expect(copied.spells.some(spell => spell.id === 2)).toBe(true);
});
