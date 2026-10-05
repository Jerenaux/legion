import {createTowerRun, chooseTowerUpgrade, finishTowerBattle, TowerProgress, TOWER_ENCOUNTERS} from '@legion/shared/tower';
import {i18n} from '../../src/i18n/core';
import {Trans} from '../../src/i18n/Trans';
// Screenshot-only providers. The release webpack config never imports this file.
import 'phaser';
import { h, render, ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';
import AuthContext from '../../src/contexts/AuthContext';
import { PlayerContext } from '../../src/contexts/PlayerContext';
import { Arena } from '../../src/game/Arena';
import {MusicManager} from '../../src/game/MusicManager';
import { EventEmitter } from 'eventemitter3';
import { NewCharacter } from '../../../shared/NewCharacter';
import { Class, League, PlayMode, StatusEffect, Terrain, LockedFeatures } from '../../../shared/enums';
import { BASE_INVENTORY_SIZE, MOVEMENT_RANGE, LOCKED_FEATURES, MAX_CHARACTERS } from '../../../shared/config';
import { GameData, StatusEffects } from '../../../shared/interfaces';
import {getClient, getReplay, type BrowserClient} from '@sentry/react';
import {route} from 'preact-router';
import {GameHUD, events} from '../../src/components/HUD/GameHUD';
import {spells} from '../../../shared/Spells';
import {items} from '../../../shared/Items';

// Observe real media playback while keeping CI silent.
const routeAudio: HTMLAudioElement[] = [];
const musicOverlaps: string[] = [];
const routeAudioPlaying = () => routeAudio.some(audio => audio.loop && !audio.paused && audio.volume > 0);
window.Audio = new Proxy(window.Audio, {construct(Target, args) {
  const audio = Reflect.construct(Target, args) as HTMLAudioElement;
  audio.muted = true;
  const play = audio.play.bind(audio);
  audio.play = () => {
    if (audio.loop && routeAudio.some(other => other !== audio && other.loop && !other.paused && other.volume > 0)) musicOverlaps.push('route');
    return play();
  };
  routeAudio.push(audio);
  return audio;
}});
const playBeginning = MusicManager.prototype.playBeginning;
MusicManager.prototype.playBeginning = function () {
  if (routeAudioPlaying()) musicOverlaps.push('combat');
  return playBeginning.call(this);
};
Object.assign(window, {routeAudio, musicOverlaps});

Object.assign(window, {replayCheck: {flush: () => getReplay()?.flush(), id: () => getReplay()?.getReplayId(),
  status: () => ({replay: Boolean(getReplay()), canvas: Boolean(getClient()?.getIntegrationByName('ReplayCanvas')),
    rate: getClient<BrowserClient>()?.getOptions().replaysSessionSampleRate})},
  stabilityFreeze: function stabilityFreeze() {
    const until = performance.now() + 11500;
    while (performance.now() < until) { /* Deliberate local-only ANR for source-map verification. */ }
  },
});

const characters = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].map((kind, i) => ({
  ...new NewCharacter(kind, 1).getCharacterData(), level: 3,
  id: `guide-${i}`, name: ['Roland', 'Luna', 'Ember'][i], portrait: ['1_1', '1_7', '1_5'][i],
  sp: 2, inventory: [0, 1], skills: [[], [9], [0, 3]][i],
}));
const profile = {
  playerName: 'Arena Apprentice', teamName: '', playerAvatar: 'default',
  playerLevel: 1, playerRank: 12, playerLeague: League.BRONZE, completedGames: 12,
  engagementStats: {completedGames: 12, everMoved: true, everAttacked: true, everUsedSpell: true, everUsedItem: true, everSawFlames: true, everSawIce: true},
};
const statuses = Object.fromEntries(Object.values(StatusEffect).map(key => [key, 0])) as StatusEffects;
const team = characters.map((character, i) => ({
  ...character, x: [4, 3, 5][i], y: [4, 6, 7][i], hp: [78, 80, 80][i], maxHP: [100, 80, 80][i],
  mp: [20, 30, 32][i], maxMP: [20, 30, 40][i], distance: MOVEMENT_RANGE, spells: character.skills, statuses,
}));
const battle = {
  general: {reconnect: true, spectator: false, mode: PlayMode.CASUAL},
  // Keep one unlearned action so the fixture exercises contextual spell coaching.
  player: {teamId: 1, player: {...profile, engagementStats: {...profile.engagementStats, everUsedSpell: false}}, team, score: 0},
  opponent: {teamId: 2, player: {...profile, playerName: 'Training Rival', playerRank: -1},
    team: team.map((unit, i) => ({...unit, x: [8, 10, 9][i], y: [4, 6, 8][i]})), score: 0},
  queue: [[3, 1], [1, 2], [2, 1], [3, 2], [1, 1], [2, 2]].map(([num, team], position) => ({num, team, position})),
  turnee: {num: 3, team: 1, turnDuration: 7, timeLeft: 7, turnNumber: 8},
  terrain: [{x: 7, y: 6, terrain: Terrain.FIRE}, {x: 8, y: 7, terrain: Terrain.ICE}], holes: [],
} as GameData;

// Feed the real scene a local gameStatus; never connect to a live match or mutate an account.
const connectToLocalServer = Arena.prototype.connectToServer;
Arena.prototype.connectToServer = async function () {
  Object.assign(window, {combatCheck: {arena: this, sent: [], route, events, spellEffects: spells.map(({id, vfx, charge}) => ({id, vfx, charge})),
    itemEffects: items.map(({animation, sfx, name}) => ({animation, sfx, name})),
    resync: () => this.initializeGame(battle),
    close: () => new GameHUD({changeMainDivClass() {}}).closeGame()}});
  if (location.pathname === '/game/practice-preview') {
    await connectToLocalServer.call(this, location.origin);
    return;
  }
  const socketURL = new URLSearchParams(location.search).get('socketURL');
  if (location.pathname.includes('/timing-')) {
    // The smoke window stays offscreen. Electron reports it hidden on Windows
    // and Linux, so model gameplay visibility explicitly on every platform.
    Object.defineProperty(document, 'hidden', {configurable: true, value: location.pathname.endsWith('/timing-hidden')});
  }
  if (location.pathname.endsWith('/timing-entrance')) {
    this.events.once('create', () => { this.tweens.timeScale = 0; });
  }
  if (socketURL) {
    if (!socketURL.startsWith('http://127.0.0.1:')) throw new Error('Smoke sockets must stay on loopback');
    await connectToLocalServer.call(this, socketURL);
    // Exercise every spell, including effects absent from the local team's loadout.
    const snapshot = {...battle, opponent: {...battle.opponent, team: battle.opponent.team.map((unit, i) => ({
      ...unit, spells: i === 2 ? spells.map(spell => spell.id) : unit.spells,
    }))}};
    this.socket.on('connect', () => this.socket.emit('fixture-ready', snapshot));
    return;
  }
  this.socket = Object.assign(new EventEmitter(), {disconnect() {}}) as typeof this.socket;
  this.enqueueMessage('queueData', battle.queue);
  const snapshot = structuredClone(battle);
  if (location.pathname.includes('/tower-fixture')) {
    snapshot.general.mode = PlayMode.TOWER;
    snapshot.general.tower = {floor: 6, tier: 1, name: 'The Cinder Warden', warning: [{x: 4, y: 4}, {x: 5, y: 4}]};
    snapshot.turnee.turnDuration = 0; snapshot.turnee.timeLeft = 0;
    snapshot.player.team[2].spells = [0, 6];
    snapshot.player.team[2].towerSpellCosts = {0: 10, 6: 15};
    this.socket.on('towerEnd', () => route('/tower'));
  }
  if (location.pathname.includes('/tower-embers')) {
    const encounter = TOWER_ENCOUNTERS[0].find(entry => entry.id === 'embers')!;
    snapshot.general.mode = PlayMode.TOWER;
    snapshot.general.tower = {floor: 1, tier: 1, name: encounter.name, warning: []};
    snapshot.turnee.turnDuration = 0; snapshot.turnee.timeLeft = 0;
    snapshot.terrain = encounter.terrain;
    snapshot.opponent.team = encounter.enemies.map(enemy => ({...snapshot.opponent.team[2],
      name: enemy.name, class: enemy.class, x: enemy.x, y: enemy.y, hp: enemy.hp, maxHP: enemy.hp,
      mp: 100, maxMP: 100, spells: enemy.spells}));
    snapshot.queue = snapshot.queue.filter(unit => unit.team !== 2 || unit.num <= encounter.enemies.length);
  }
  this.enqueueMessage('gameStatus', snapshot);
};

export async function getFirebaseIdToken() { return 'guide-local-only'; }
const rankCheck = {fail: true};
Object.assign(window, {rankCheck});
const towerCheck = {
  requests: [] as string[],
  fail: false,
  progress: JSON.parse(localStorage.getItem('tower-fixture') || '{"run":null,"highestClear":0}') as TowerProgress,
  win() {
    const run = this.progress.run!;
    finishTowerBattle(run, {won: true, units: run.squad.map(unit => ({hp: unit.hp, mp: unit.mp, inventory: unit.character.inventory}))});
    this.save();
  },
  save() { localStorage.setItem('tower-fixture', JSON.stringify(this.progress)); },
};
Object.assign(window, {towerCheck});
export async function apiFetch(endpoint: string, options: {body?: {action?: string; tier?: number; kit?: 'balanced' | 'control'; upgrade?: string; encounter?: string}} = {}) {
  if (endpoint === 'tower') {
    towerCheck.requests.push(options.body?.action || 'read');
    if (towerCheck.fail) throw new Error('Expected tower timeout');
    const body = options.body;
    if (body?.action === 'create') towerCheck.progress.run = createTowerRun('fixture-run', body.tier, body.kit);
    const run = towerCheck.progress.run;
    if (body?.action === 'upgrade') chooseTowerUpgrade(run, body.upgrade);
    if (body?.action === 'retire') run.phase = 'retired';
    if (body?.action === 'battle') { run.phase = 'battle'; run.path.push(body.encounter); run.gameId = 'tower-fixture'; }
    towerCheck.save();
    return structuredClone(towerCheck.progress);
  }
  if (endpoint === 'recordPlayerAction') return {};
  if (endpoint === 'listOnSaleCharacters') return characters.map(character => ({...character, price: 120}));
  if (endpoint.startsWith('fetchLeaderboard?tab=')) {
    if (rankCheck.fail) throw new Error('Expected leaderboard timeout');
    return {league: Number(endpoint.split('=')[1]), seasonEnd: 3600, playerRank: 1, ranking: [], highlights: [
      {id: 'guide-award', name: 'Arena Apprentice', avatar: 'default', title: 'Ace Player', description: 'Highest Game Grades'},
    ]};
  }
  throw new Error(`Unexpected API call in guide smoke test: ${endpoint}`);
}

export function FixtureAuth({children}: {children: ComponentChildren}) {
  return <AuthContext.Provider value={{user: null, isAuthenticated: true, isLoading: false, retrySession: async () => {}}}>{children}</AuthContext.Provider>;
}

const queueCheck = {socket: Object.assign(new EventEmitter(), {connected: true}), joins: 0, leaves: 0};
queueCheck.socket.on('joinQueue', () => {
  queueCheck.joins++;
  queueCheck.socket.emit('queueData', {goldRewardInterval: 30, goldReward: 1, estimatedWaitingTime: 20, nbInQueue: 12});
});
queueCheck.socket.on('leaveQueue', () => {queueCheck.leaves++;});
Object.assign(window, {queueCheck});

export default function FixturePlayer({children}: {children: ComponentChildren}) {
  const defaults = useContext(PlayerContext);
  const [preview] = useState(() => new URLSearchParams(location.search));
  const completedGames = Math.max(0, Number(preview.get('games') ?? 12));
  const rosterSize = Math.max(3, Math.min(MAX_CHARACTERS, Number(preview.get('roster') ?? 3)));
  const roster = Array.from({length: rosterSize}, (_, i) => i < characters.length ? characters[i]
    : {...characters[i % characters.length], id: `guide-${i}`, name: ['Aldric', 'Iris', 'Vex'][i - 3]});
  const [activeId, setActiveId] = useState(characters[2].id);
  const [loaded, setLoaded] = useState(!new URLSearchParams(location.search).has('loading'));
  const [renderFailed, setRenderFailed] = useState(false);
  Object.assign(window, {titleLoadingCheck: {finish: () => setLoaded(true), fail: () => setRenderFailed(true)}});
  if (renderFailed) throw new Error('telemetry-smoke-render-error');
  const value = {
    ...defaults, loaded, welcomeShown: true, characters: roster, activeCharacterId: activeId,
    socket: queueCheck.socket as unknown as typeof defaults.socket,
    player: {...defaults.player, uid: 'guide-local-only', name: profile.playerName, avatar: 'default',
      isLoaded: loaded, completedGames: completedGames + 1, engagementStats: {...profile.engagementStats, completedGames: completedGames + 1}, gold: 240, elo: 128, rank: 12,
      carrying_capacity: BASE_INVENTORY_SIZE, inventory: {consumables: [0, 0, 1, 6], spells: [6], equipment: []}},
    canAccessFeature: (feature: LockedFeatures) => completedGames >= LOCKED_FEATURES[feature],
    getCompletedGames: () => completedGames, checkEngagementFlag: () => true,
    getGamesUntilFeature: (feature: LockedFeatures) => Math.max(0, LOCKED_FEATURES[feature] - completedGames),
    getCharacter: (id: string) => roster.find(character => character.id === id),
    getActiveCharacter: () => roster.find(character => character.id === activeId),
    updateActiveCharacter: (id: string) => {if (id) setActiveId(id);},
  };
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

// Exercise player-name escaping and the profile without any external requests.
Object.assign(window, {localizationProbe: () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  render(<Trans i18n={i18n} i18nKey="Do you want to play against <0>{{value0}}</0> ?"
    components={[<strong />]} values={{value0: '<img src=x onerror=alert(1)>&"'}} />, element);
  const result = {text: element.textContent, images: element.querySelectorAll('img').length, strong: element.querySelectorAll('strong').length};
  render(null, element);
  element.remove();
  return result;
}});
window.fetch = new Proxy(window.fetch, {apply(target, receiver, [input, init]) {
  if (String(input).includes('/getProfileData?')) return Promise.resolve(Response.json({
    name: 'Arena Apprentice', avatar: 'default', elo: 12345, joinDate: '2025-05-06T12:00:00Z',
    allTimeStats: {nbGames: 123, wins: 82, losses: 41, winStreak: 7, lossStreak: 2, rank: 12},
    leagueStats: {gamesPlayed: 15, wins: 10, winStreak: 3, lossStreak: 1, league: League.BRONZE},
    casualStats: {gamesPlayed: 30, wins: 20},
  }));
  return Reflect.apply(target, receiver, [input, init]);
}});
