import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as preact from 'preact';
import * as inventory from '@legion/shared/inventory';
import * as enums from '@legion/shared/enums';
import * as config from '@legion/shared/config';
import * as levelling from '@legion/shared/levelling';
import * as items from '@legion/shared/Items';
import * as spells from '@legion/shared/Spells';
import * as equipment from '@legion/shared/Equipments';
import {NewCharacter} from '@legion/shared/NewCharacter';

// Same approach as the music-controller tests: execute the real provider and
// shared inventory functions, isolating only browser, authentication and network IO.
const code = ts.transpileModule(readFileSync(new URL('../PlayerProvider.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h'},
}).outputText;

function setup(completedGames = 2, kind = enums.Class.WARRIOR) {
    const auth = {currentUser: {uid: 'player-a'}};
    const requests: ((data: unknown) => void)[] = [];
    const modules = {
        preact,
        '../contexts/PlayerContext': {PlayerContext: {}},
        '../services/apiService': {apiFetch: () => new Promise(resolve => { requests.push(resolve); })},
        '../services/firebaseService': {firebaseAuth: auth},
        '../components/utils': {playSoundEffect() {}, errorToast(message: string) { throw new Error(message); }},
        'socket.io-client': {}, 'preact-router': {}, '../services/socketPolicy': {},
        '@legion/shared/inventory': inventory, '@legion/shared/enums': enums,
        '@legion/shared/config': config, '@legion/shared/levelling': levelling,
        '@legion/shared/Items': items, '@legion/shared/Spells': spells, '@legion/shared/Equipments': equipment,
    };
    const exports = {} as {default: typeof import('../PlayerProvider').default};
    runInNewContext(code, {exports, structuredClone, console, setTimeout, clearTimeout,
        process: {env: {NODE_ENV: 'test'}}, require: (name: string) => {
            if (name.startsWith('@assets/')) return name;
            if (name in modules) return modules[name];
            throw new Error(`Unexpected provider dependency: ${name}`);
        }});
    const provider = new exports.default({});
    provider.setState = (update, callback) => {
        const patch = typeof update === 'function' ? update(provider.state, provider.props) : update;
        provider.state = {...provider.state, ...patch};
        callback?.();
    };
    const character = {...new NewCharacter(kind, 20).getCharacterData(), id: 'character-a',
        inventory: [0], skills: [], level: 20};
    character.equipment.weapon = kind === enums.Class.WARRIOR ? 0 : 1;
    provider.state = {...provider.state, characters: [character], activeCharacterId: character.id,
        player: {...provider.state.player, uid: 'player-a', isLoaded: true, gold: 100, carrying_capacity: 100,
            inventory: {consumables: [0], equipment: [0], spells: [0]},
            engagementStats: {completedGames, everMoved: true, everUsedSpell: true}}};
    return {provider, auth, requests};
}

for (const completed of [0, 1, 2, 6, 13]) {
    for (const type of [enums.ItemDialogType.CONSUMABLES, enums.ItemDialogType.EQUIPMENTS]) {
        test(`unequip ${type} preserves progress and unlocks at ${completed} completed games`, () => {
            const {provider} = setup(completed);
            const before = structuredClone(provider.state);
            const previousState = provider.state;
            const available = Object.values(enums.LockedFeatures).filter(value => typeof value === 'number')
                .map(feature => provider.canAccessFeature(feature as enums.LockedFeatures));
            provider.updateInventory(type, enums.InventoryActionType.UNEQUIP, 0);
            expect(provider.state.player.engagementStats).toEqual(before.player.engagementStats);
            expect(Object.values(enums.LockedFeatures).filter(value => typeof value === 'number')
                .map(feature => provider.canAccessFeature(feature as enums.LockedFeatures))).toEqual(available);
            expect(previousState).toEqual(before);
            expect('inventory' in provider.state).toBe(false);
            expect(provider.state.player.inventory[type]).toHaveLength(2);
        });
    }
}

for (const type of [enums.ItemDialogType.CONSUMABLES, enums.ItemDialogType.EQUIPMENTS, enums.ItemDialogType.SPELLS]) {
    test(`equipping ${type} keeps all progress flags and updates the nested player inventory`, () => {
        const {provider} = setup(13, type === enums.ItemDialogType.SPELLS ? enums.Class.BLACK_MAGE : enums.Class.WARRIOR);
        provider.state.characters[0].inventory = [];
        provider.state.characters[0].equipment.weapon = -1;
        const previousState = provider.state;
        const before = structuredClone(previousState);
        provider.updateInventory(type, enums.InventoryActionType.EQUIP, 0);
        expect(provider.getCompletedGames()).toBe(12);
        expect(provider.state.player.engagementStats.everMoved).toBe(true);
        expect(provider.state.player.engagementStats.everUsedSpell).toBe(true);
        expect(provider.state.player.inventory[type]).toHaveLength(0);
        expect(previousState).toEqual(before);
        expect('inventory' in provider.state).toBe(false);
    });
}

test('selling an item and applying a partial progress update cannot relock the shop', () => {
    const {provider} = setup();
    provider.updateInventory(enums.ItemDialogType.CONSUMABLES, enums.InventoryActionType.SELL, 0);
    provider.setPlayerInfo({engagementStats: {everPurchased: true}});
    expect(provider.canAccessFeature(enums.LockedFeatures.CONSUMABLES_BATCH_1)).toBe(true);
    expect(provider.state.player.engagementStats.everUsedSpell).toBe(true);
    expect(provider.state.player.engagementStats.everPurchased).toBe(true);
});

test('an older profile response cannot overwrite newly fetched unlock progress', async () => {
    const {provider, requests} = setup(1);
    const old = provider.fetchPlayerData();
    const fresh = provider.fetchPlayerData();
    requests[1]({...provider.state.player, gold: 200, engagementStats: {completedGames: 2}});
    await fresh;
    requests[0]({...provider.state.player, gold: 100, engagementStats: {completedGames: 1}});
    await old;
    expect(provider.canAccessFeature(enums.LockedFeatures.CONSUMABLES_BATCH_1)).toBe(true);
    expect(provider.state.player.gold).toBe(200);
});

test('profile responses from an earlier account or reset cannot restore old unlocks', async () => {
    const {provider, requests, auth} = setup(13);
    const pending = provider.fetchPlayerData();
    auth.currentUser = {uid: 'player-b'};
    provider.resetState();
    requests[0]({engagementStats: {completedGames: 13}});
    await pending;
    expect(provider.state.player.uid).toBe('');
    expect(provider.getCompletedGames()).toBe(0);
});
