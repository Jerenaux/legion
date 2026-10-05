import { expect, test } from 'bun:test';
import { EventEmitter } from 'eventemitter3';
import { TutorialManager, type TutorialContext, type TutorialMessage } from '../TutorialManager';

const warrior: TutorialContext = {
    turn: 1, name: 'Roland', ownTurn: true, selectedIsTurnee: true, canAct: true,
    hasEnemy: false, spells: [], hasItem: false, mp: 20,
    fire: false, ice: false, poison: false, muted: false, paralyzed: false,
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

test('hints stay until accepted actions; rejected/submitted clicks never count as learned', () => {
    const s = setup();
    expect(s.show().content).toContain('Moving ends your turn');
    s.events.emit('performAction');
    s.events.emit('actionRejected');
    expect(s.message().learned).toBe(0);
    s.events.emit('playerMoved');
    expect(s.message()).toMatchObject({title: 'Turn over', learned: 1, focus: 'timeline'});
    expect(s.show().title).toBe('Turn over'); // HUD refresh cannot resurrect the old instruction.
    expect(s.show({turn: 2, ownTurn: false})).toBeUndefined();
    expect(s.show({turn: 3, hasEnemy: true}).learned).toBe(1);
    s.manager.destroy();
});

test('melee is taught even if movement was learned in a previous match', () => {
    const s = setup({everMoved: true});
    expect(s.show({hasEnemy: true}).title).toBe('Attack');
    s.events.emit('playerAttacked');
    expect(s.message().learned).toBe(2);
    s.manager.destroy();
});

test('casters of either class get targeting, cost, area warning, and cancel guidance without cooldown loss', () => {
    const s = setup();
    s.show();
    const spell = {name: 'Fire', cost: 8};
    expect(s.show({spells: [spell]}).focus).toBe('spells');
    expect(s.show({spells: [spell], pendingSpell: {...spell, area: true}}))
        .toMatchObject({content: 'Select a highlighted target. Select the spell again to cancel.', cost: 8, warning: 'Can hit allies'});
    expect(s.show({spells: [spell], pendingSpell: {...spell, area: false}}).warning).toBeUndefined();
    expect(s.show({spells: [{name: 'Cure', cost: 8}]}).focus).toBe('spells');
    s.events.emit('playerCastSpell');
    expect(s.message().learned).toBe(1); // Casting first never requires repeating movement first.
    expect(s.show({turn: 2, spells: [spell]}).content).toContain('Moving ends your turn');
    s.manager.destroy();
});

test('current hazards and unavailable actions take priority over generic movement', () => {
    const s = setup();
    expect(s.show({ice: true}).title).toBe('Frozen in ice');
    expect(s.show({fire: true}).title).toBe('Move out of the flames');
    expect(s.show({muted: true}).title).toBe('Silenced');
    expect(s.show({mp: 0, spells: [{name: 'Fire', cost: 8}]}).title).toBe('Low mana');
    expect(s.show({selectedIsTurnee: false}).title).toBe('Roland acts now');
    expect(s.show().title).toBe('Move'); // Old warnings aren't queued after they stop applying.
    s.manager.destroy();
});

test('learned actions stop generic hints while targeting and hazards remain available', () => {
    const s = setup({everMoved: true, everAttacked: true, everUsedSpell: true, everUsedItem: true});
    expect(s.show({hasEnemy: true, spells: [{name: 'Fire', cost: 8}], hasItem: true})).toBeUndefined();
    expect(s.show({fire: true}).icon).toBe('move');
    expect(s.show({pendingSpell: {name: 'Fire', cost: 8, area: true}}).cost).toBe(8);
    expect(s.show()).toBeUndefined();
    s.manager.destroy();
});

test('ending and destroying guidance removes only its own listeners', () => {
    const s = setup();
    let external = 0;
    s.events.on('playerMoved', () => { external++; });
    s.show();
    s.events.emit('gameEnd');
    const final = s.message();
    s.events.emit('playerMoved');
    expect(s.message()).toBe(final);
    s.manager.destroy();
    s.events.emit('playerMoved');
    expect(external).toBe(2);
    expect(s.events.listenerCount('playerMoved')).toBe(1);
    expect(s.events.listenerCount('tutorialContext')).toBe(0);
});


test('healing guidance waits for an injured ally; enemy turns hide even accepted-action hints', () => {
    const s = setup();
    const healer = {spells: [{name: 'Heal', cost: 15, healing: true}]};
    expect(s.show(healer).title).toBe('Keep your healer safe');
    expect(s.show({...healer, hasWoundedAlly: true}).focus).toBe('spells');
    s.events.emit('playerMoved');
    expect(s.show({ownTurn: false})).toBeUndefined();
    expect(s.show({...healer, turn: 2}).title).toBe('Keep your healer safe');
    s.manager.destroy();
});
