// Screenshot-only providers. The release webpack config never imports this file.
import 'phaser';
import { h, ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';
import AuthContext from '../../src/contexts/AuthContext';
import { PlayerContext } from '../../src/contexts/PlayerContext';
import { Arena } from '../../src/game/Arena';
import { EventEmitter } from 'eventemitter3';
import { NewCharacter } from '../../../shared/NewCharacter';
import { Class, League, PlayMode, StatusEffect, Terrain } from '../../../shared/enums';
import { BASE_INVENTORY_SIZE, MOVEMENT_RANGE } from '../../../shared/config';
import { GameData, StatusEffects } from '../../../shared/interfaces';

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
  player: {teamId: 1, player: profile, team, score: 0},
  opponent: {teamId: 2, player: {...profile, playerName: 'Training Rival', playerRank: -1},
    team: team.map((unit, i) => ({...unit, x: [8, 10, 9][i], y: [4, 6, 8][i]})), score: 0},
  queue: [[3, 1], [1, 2], [2, 1], [3, 2], [1, 1], [2, 2]].map(([num, team], position) => ({num, team, position})),
  turnee: {num: 3, team: 1, turnDuration: 7, timeLeft: 7, turnNumber: 8},
  terrain: [{x: 7, y: 6, terrain: Terrain.FIRE}, {x: 8, y: 7, terrain: Terrain.ICE}], holes: [],
} as GameData;

// Feed the real scene a local gameStatus; never connect to a live match or mutate an account.
Arena.prototype.connectToServer = async function () {
  Object.assign(window, {combatCheck: {arena: this, sent: []}});
  this.socket = Object.assign(new EventEmitter(), {disconnect() {}}) as typeof this.socket;
  this.events.once('create', () => this.initializeGame(battle));
};

export async function getFirebaseIdToken() { return 'guide-local-only'; }
export async function apiFetch(endpoint: string) {
  if (endpoint === 'recordPlayerAction') return {};
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
  const [activeId, setActiveId] = useState(characters[2].id);
  const value = {
    ...defaults, loaded: true, welcomeShown: true, characters, activeCharacterId: activeId,
    socket: queueCheck.socket as unknown as typeof defaults.socket,
    player: {...defaults.player, uid: 'guide-local-only', name: profile.playerName, avatar: 'default',
      isLoaded: true, completedGames: 12, engagementStats: profile.engagementStats, gold: 240, elo: 128, rank: 12,
      carrying_capacity: BASE_INVENTORY_SIZE, inventory: {consumables: [0, 0, 1, 6], spells: [6], equipment: []}},
    canAccessFeature: () => true, getCompletedGames: () => 12, checkEngagementFlag: () => true,
    getCharacter: (id: string) => characters.find(character => character.id === id),
    getActiveCharacter: () => characters.find(character => character.id === activeId),
    updateActiveCharacter: (id: string) => {if (id) setActiveId(id);},
  };
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
