import {expect, test} from 'bun:test';
import {EventEmitter} from 'eventemitter3';
import {TutorialManager, type TutorialContext, type TutorialMessage} from '../TutorialManager';

const warrior: TutorialContext = {
  turn: 1, name: 'Roland', ownTurn: true, selectedIsTurnee: true, canAct: true,
  hasEnemy: false, hasSpells: false, spellInRange: false, pendingItem: false, ice: false,
};
function setup(stats = {}) {
  const events = new EventEmitter();
  let message: TutorialMessage;
  const manager = new TutorialManager(events, stats);
  events.on('showTutorialMessage', next => {message = next;});
  events.on('hideTutorialMessage', () => {message = undefined;});
  return {events, manager, message: () => message, show: (context: Partial<TutorialContext> = {}) => {
    events.emit('tutorialContext', {...warrior, ...context}); return message;
  }};
}

test('context selects the useful unlearned action, not a fixed teaching sequence', () => {
  const s = setup();
  expect(s.show().title).toBe('Move');
  expect(s.show({hasEnemy: true}).title).toBe('Attack');
  expect(s.show({hasSpells: true, spellInRange: true}).focus).toBe('spells');
  s.events.emit('performAction');
  s.events.emit('actionRejected');
  expect(s.message().learned).toBe(0);
  s.events.emit('playerCastSpell');
  expect(s.message()).toBeUndefined();
  expect(s.show({turn: 2, hasSpells: true, spellInRange: true}).title).toBe('Move');
  s.events.emit('playerMoved');
  expect(s.show({turn: 3, hasItem: true}).focus).toBe('items');
  s.events.emit('playerUseItem');
  expect(s.show({turn: 4, hasItem: true})).toBeUndefined();
  s.manager.destroy();
});

test('hazards take priority, remain visible this turn, and are remembered', () => {
  const s = setup({everMoved: true});
  for (const [field, title] of [['fire', 'Flames'], ['ice', 'Frozen in ice'], ['poison', 'Poison'], ['muted', 'Silence'], ['paralyzed', 'Paralysis'], ['lowMP', 'Low mana']] as const) {
    expect(s.show({[field]: true}).title).toBe(title);
    expect(s.show({[field]: true}).title).toBe(title);
    expect(s.show({turn: 2, [field]: true})).toBeUndefined();
  }
  s.manager.destroy();
  const experienced = setup({everMoved: true, everSawFlames: true, everSawIce: true});
  expect(experienced.show({fire: true, ice: true})).toBeUndefined();
  experienced.manager.destroy();
});

test('targeting, spent actions, and enemy turns do not receive stale prompts', () => {
  const s = setup();
  expect(s.show({ownTurn: false})).toBeUndefined();
  expect(s.show({canAct: false})).toBeUndefined();
  expect(s.show({hasSpells: true, spellInRange: false}).focus).toBeUndefined();
  expect(s.show({pendingSpell: true})).toBeUndefined();
  expect(s.show({pendingItem: true})).toBeUndefined();
  expect(s.show({selectedIsTurnee: false}).title).toContain('Roland');
  s.show(); s.events.emit('playerMoved');
  expect(s.show()).toBeUndefined();
  s.manager.destroy();
});

test('ending and destroying guidance removes only its own listeners', () => {
  const s = setup(); let external = 0;
  s.events.on('playerMoved', () => {external++;});
  s.show(); s.events.emit('gameEnd'); s.events.emit('playerMoved');
  expect(s.message()).toBeUndefined();
  s.manager.destroy(); s.events.emit('playerMoved');
  expect(external).toBe(2);
  expect(s.events.listenerCount('playerMoved')).toBe(1);
  expect(s.events.listenerCount('tutorialContext')).toBe(0);
});
