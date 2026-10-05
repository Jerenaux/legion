import { expect, test } from 'bun:test';
import { EventEmitter } from 'eventemitter3';
import { TutorialManager, type TutorialContext, type TutorialMessage } from '../TutorialManager';

const warrior: TutorialContext = {
    turn: 1, name: 'Roland', ownTurn: true, selectedIsTurnee: true, canAct: true,
    hasEnemy: false, hasSpells: false, spellInRange: false, pendingItem: false, ice: false,
};

function setup(stats = {}) {
    const events = new EventEmitter();
    let message: TutorialMessage;
    const manager = new TutorialManager(events, stats);
    events.on('showTutorialMessage', next => { message = next; });
    events.on('hideTutorialMessage', () => { message = undefined; });
    return { events, manager, show: (context: Partial<TutorialContext> = {}) => {
        events.emit('tutorialContext', {...warrior, ...context});
        return message;
    }, message: () => message };
}

test('one-action rule comes first; only an accepted action advances to turn order', () => {
    const s = setup();
    expect(s.show({hasSpells: true, spellInRange: true}).title).toBe('One action per turn');
    s.events.emit('performAction');
    s.events.emit('actionRejected');
    expect(s.message().learned).toBe(0);
    s.events.emit('playerMoved');
    expect(s.message()).toMatchObject({title: 'Turn order', learned: 1, focus: 'timeline'});
    expect(s.show().title).toBe('Turn order');
    expect(s.show({turn: 2, ownTurn: false})).toBeUndefined();
    expect(s.show({turn: 3, hasSpells: true, spellInRange: true}).focus).toBe('spells');
    s.events.emit('playerCastSpell');
    expect(s.message()).toBeUndefined(); // No repeated action confirmations.
    s.manager.destroy();
});

test('distant targets get positioning guidance, never an invitation to cast', () => {
    const s = setup({everMoved: true});
    expect(s.show({hasSpells: true, spellInRange: false})).toMatchObject({title: 'Out of range', icon: 'move'});
    expect(s.message().focus).toBeUndefined();
    expect(s.show({hasSpells: true, spellInRange: true})).toMatchObject({title: 'Spell controls', focus: 'spells'});
    expect(s.show({pendingSpell: {name: 'Fire', hasTarget: false}}).content).toContain('No target in range');
    const targeting = s.show({pendingSpell: {name: 'Fire', hasTarget: true}});
    expect(targeting.content).toContain('colored tiles show range');
    expect(targeting.content).toContain('again to cancel');
    expect(targeting).not.toHaveProperty('cost');
    expect(s.show({hasSpells: false})).toBeUndefined(); // Mana/silence stay in normal action feedback.
    s.manager.destroy();
});

test('casting first still teaches turn order and avoids repeating the one-action lesson', () => {
    const s = setup();
    s.show({hasSpells: true, spellInRange: true});
    s.events.emit('playerCastSpell');
    expect(s.message()).toMatchObject({title: 'Turn order', learned: 1});
    expect(s.show({turn: 2, hasSpells: true, spellInRange: true})).toBeUndefined();
    s.manager.destroy();
});

test('spell controls transfer to the healer and do not repeat targeting or item lessons', () => {
    const s = setup({everMoved: true, everUsedSpell: true});
    expect(s.show({hasSpells: true, spellInRange: true})).toBeUndefined();
    expect(s.show({pendingSpell: {name: 'Heal', hasTarget: true}})).toBeUndefined();
    expect(s.show({pendingItem: true})).toBeUndefined();
    expect(s.show({hasEnemy: true}).title).toBe('Attack');
    s.events.emit('playerAttacked');
    expect(s.message()).toBeUndefined();
    expect(s.show({turn: 2, hasEnemy: true})).toBeUndefined();
    s.manager.destroy();
});

test('selection and breakable ice explain Legion controls; enemy turns stay quiet', () => {
    const s = setup({everMoved: true});
    expect(s.show({ice: true, canAct: false}).title).toBe('Frozen in ice');
    expect(s.show({canAct: false})).toBeUndefined();
    expect(s.show({selectedIsTurnee: false}).title).toBe('Roland acts now');
    expect(s.show({ownTurn: false, selectedIsTurnee: false})).toBeUndefined();
    s.manager.destroy();
});

test('ending and destroying guidance removes only its own listeners', () => {
    const s = setup();
    let external = 0;
    s.events.on('playerMoved', () => { external++; });
    s.show();
    s.events.emit('gameEnd');
    s.events.emit('playerMoved');
    expect(s.message()).toBeUndefined();
    s.manager.destroy();
    s.events.emit('playerMoved');
    expect(external).toBe(2);
    expect(s.events.listenerCount('playerMoved')).toBe(1);
    expect(s.events.listenerCount('tutorialContext')).toBe(0);
});
