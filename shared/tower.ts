import {Class, Terrain, RewardType} from './enums';
import {NewCharacter} from './NewCharacter';
import {DBCharacterData, ChestReward} from './interfaces';
import {getXPThreshold} from './levelling';

export const TOWER_FLOORS = 6;
export const TOWER_MAX_TIER = 5;
export type TowerKit = 'balanced' | 'control';
export interface TowerUnit {
  character: DBCharacterData;
  hp: number;
  mp: number;
}
export interface TowerReward {gold: number; xp: number; items: ChestReward[]}
export interface TowerRun {
  id: string;
  revision: number;
  tier: number;
  kit: TowerKit;
  floor: number; // Number of victories, not a match/unlock counter.
  phase: 'ready' | 'battle' | 'choice' | 'won' | 'lost' | 'retired';
  squad: TowerUnit[];
  upgrades: string[];
  offers: string[];
  path: string[];
  gameId: string | null;
  earned: TowerReward;
  lastReward: TowerReward;
}
export interface TowerProgress {run: TowerRun | null; highestClear: number}
export interface TowerEnemy {name: string; class: Class; hp: number; spells: number[]; x: number; y: number; boss?: boolean}
export interface TowerEncounter {
  id: string; name: string; description: string; elite: boolean;
  enemies: TowerEnemy[];
  terrain: {x: number; y: number; terrain: Terrain}[];
}
const fighter = (name: string, x = 9, y = 5, hp = 100): TowerEnemy => ({name, class: Class.WARRIOR, hp, spells: [], x, y});
const mage = (name: string, spells: number[], x = 11, y = 5, hp = 70): TowerEnemy => ({name, class: Class.BLACK_MAGE, hp, spells, x, y});
const healer = (x = 12, y = 5): TowerEnemy => ({name: 'Sanctum Keeper', class: Class.WHITE_MAGE, hp: 80, spells: [9], x, y});
const ice = (x: number, y: number) => ({x, y, terrain: Terrain.ICE});
const fire = (x: number, y: number) => ({x, y, terrain: Terrain.FIRE});

// Authored encounters: paths change positioning and threats, not just enemy health.
export const TOWER_ENCOUNTERS: TowerEncounter[][] = [
  [
    {id: 'gate', name: 'The Broken Gate', description: 'Two sentries guard the entrance. Isolate one before its ally can help.', elite: false,
      enemies: [fighter('Gate Sentry', 9, 4, 80), fighter('Gate Sentry', 10, 7, 80)], terrain: []},
    {id: 'embers', name: 'Ember Approach', description: 'A fire mage waits behind a guard. Burning ground punishes a direct advance.', elite: true,
      enemies: [fighter('Ash Guard', 9, 5, 85), mage('Ember Adept', [0], 11, 6, 65)], terrain: [fire(7, 5), fire(8, 5)]},
  ],
  [
    {id: 'sanctum', name: 'The Warded Sanctum', description: 'A keeper heals the guards. Reach the support or overwhelm one target.', elite: false,
      enemies: [fighter('Ward Guard', 9, 4), fighter('Ward Guard', 9, 7), healer()], terrain: [ice(8, 5)]},
    {id: 'frost', name: 'Frozen Passage', description: 'An ice caster controls the passage. Fire melts ice; attacks break it.', elite: true,
      enemies: [fighter('Frost Guard', 9, 6), mage('Frostbinder', [6], 11, 4)], terrain: [ice(7, 4), ice(7, 5), ice(7, 7)]},
  ],
  [
    {id: 'crossfire', name: 'Crossfire Gallery', description: 'Two casters cover separate lanes. Keep your formation spread out.', elite: false,
      enemies: [mage('North Flame', [0, 1], 10, 3), mage('South Flame', [0, 1], 10, 8), fighter('Gallery Guard')], terrain: [ice(8, 5), ice(8, 6)]},
    {id: 'venom', name: 'The Venom Court', description: 'Poison and silence threaten a long battle. Supplies and early pressure matter.', elite: true,
      enemies: [mage('Venom Herald', [10, 0], 10, 3), mage('Quiet Herald', [11, 0], 11, 7), fighter('Court Guard', 9, 5, 120)], terrain: [fire(7, 4), fire(7, 7)]},
  ],
  [
    {id: 'vanguard', name: 'Iron Vanguard', description: 'Three fighters approach together. Use terrain to separate their attacks.', elite: false,
      enemies: [fighter('Vanguard', 9, 3, 125), fighter('Vanguard', 9, 6, 125), fighter('Vanguard', 10, 8, 125)], terrain: [ice(7, 4), ice(8, 7)]},
    {id: 'storm', name: 'Storm Chamber', description: 'Thunder threatens paralysis. A distant keeper sustains the storm caller.', elite: true,
      enemies: [mage('Storm Caller', [3, 0], 10, 5, 100), healer(12, 6), fighter('Storm Guard', 9, 3, 125)], terrain: [ice(8, 4), ice(8, 6)]},
  ],
  [
    {id: 'last-watch', name: 'The Last Watch', description: 'A mixed formation tests everything you have gathered. Save enough for the summit.', elite: false,
      enemies: [fighter('Watch Captain', 9, 4, 150), mage('Watch Pyromancer', [0, 1], 11, 7, 95), healer(12, 4)], terrain: [fire(8, 5), ice(8, 7)]},
    {id: 'crucible', name: 'The Crucible', description: 'Four defenders hold two lanes. A harder route earns a larger account reward.', elite: true,
      enemies: [fighter('Crucible Guard', 9, 3, 130), fighter('Crucible Guard', 9, 8, 130), mage('Crucible Flame', [1], 11, 4, 90), mage('Crucible Ice', [6], 11, 7, 90)], terrain: [fire(7, 5), fire(8, 6)]},
  ],
  [{id: 'warden', name: 'The Cinder Warden', description: 'The Warden marks a blast before each of its turns. Move off the marked tiles before it acts. Defeat its escorts to gain room.', elite: false,
    enemies: [{...mage('Cinder Warden', [0, 1], 11, 5, 240), boss: true}, fighter('Cinder Shield', 9, 3, 130), healer(12, 8)], terrain: [ice(8, 4), ice(8, 7)]}],
];

export const TOWER_UPGRADES = [
  {id: 'rest', name: 'Sanctuary', description: 'Restore the whole squad to full HP and MP.'},
  {id: 'supplies', name: 'Quartermaster', description: 'Refill each fighter with Potions and each mage with Ether, up to carrying capacity.'},
  {id: 'ice', name: 'Winter Lesson', description: 'Teach the Black Mage Ice. Replaces the oldest spell if all three slots are filled.'},
  {id: 'thunder', name: 'Storm Lesson', description: 'Teach the Black Mage Thunder. Replaces the oldest spell if necessary.'},
  {id: 'poison', name: 'Venom Lesson', description: 'Teach the Black Mage Poison. Replaces the oldest spell if necessary.'},
  {id: 'silence', name: 'Quiet Lesson', description: 'Teach the Black Mage Silence. Replaces the oldest spell if necessary.'},
  {id: 'fire-plus', name: 'Spreading Flame', description: 'Teach the Black Mage Fire+. Replaces the oldest spell if necessary.'},
  {id: 'frostcraft', name: 'Sculptor of Ice', description: 'Learn Ice. Ice costs 15 less MP but deals half damage for this run.'},
  {id: 'swift', name: 'Light Footwork', description: 'Warrior movement reaches one tile farther; gain 12 Speed.'},
  {id: 'guard', name: 'Tempered Armor', description: 'Everyone gains 30 maximum and current HP, and 1 DEF.'},
  {id: 'focus', name: 'Deep Reserves', description: 'Mages gain 30 maximum and current MP, and 2 SP.ATK.'},
  {id: 'satchel', name: 'Field Satchels', description: 'Everyone gains one carrying slot and refills their supplies.'},
];
const lesson: Record<string, number> = {ice: 6, thunder: 3, poison: 10, silence: 11, 'fire-plus': 1, frostcraft: 6};
export const towerTerminal = (run: TowerRun) => ['won', 'lost', 'retired'].includes(run.phase);
export const emptyTowerReward = (): TowerReward => ({gold: 0, xp: 0, items: []});

export function towerCharacter(characterClass: Class, name: string): DBCharacterData {
  const data = new NewCharacter(characterClass).getCharacterData();
  data.name = name;
  data.level = 1;
  data.skill_slots = 3;
  data.stats = {hp: characterClass === Class.WARRIOR ? 180 : 120, mp: characterClass === Class.WARRIOR ? 0 : 80,
    atk: characterClass === Class.WARRIOR ? 14 : 5, def: characterClass === Class.WARRIOR ? 4 : 2, spatk: 8, spdef: 5, speed: 20};
  data.skills = characterClass === Class.WHITE_MAGE ? [9] : characterClass === Class.BLACK_MAGE ? [0] : [];
  data.inventory = characterClass === Class.WARRIOR ? [0, 0, 8] : [1, 1, 0];
  return data;
}

export function createTowerRun(id: string, tier: number, kit: TowerKit): TowerRun {
  const squad = [towerCharacter(Class.WARRIOR, 'Flint'), towerCharacter(Class.WHITE_MAGE, 'Lumen'), towerCharacter(Class.BLACK_MAGE, 'Ember')];
  if (kit === 'control') { squad[2].skills = [6, 10]; squad[2].stats.mp += 20; squad[0].stats.hp -= 30; }
  return {id, revision: 0, tier, kit, floor: 0, phase: 'ready', squad: squad.map(character => ({character, hp: character.stats.hp, mp: character.stats.mp})),
    upgrades: [], offers: [], path: [], gameId: null, earned: emptyTowerReward(), lastReward: emptyTowerReward()};
}

export function towerOffers(run: TowerRun): string[] {
  const blackMage = run.squad.find(unit => unit.character.class === Class.BLACK_MAGE);
  const candidates = TOWER_UPGRADES.map(upgrade => upgrade.id).filter(id => !['rest', 'supplies'].includes(id) && !run.upgrades.includes(id)
    && (!(id in lesson) || id === 'frostcraft' || !blackMage?.character.skills.includes(lesson[id])));
  let seed = 0;
  for (const char of `${run.id}:${run.floor}`) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
  const offset = seed % candidates.length;
  return ['rest', 'supplies', ...Array.from({length: Math.min(2, candidates.length)}, (_, i) => candidates[(offset + i) % candidates.length])];
}

export function chooseTowerUpgrade(run: TowerRun, id: string): void {
  if (run.phase !== 'choice' || !run.offers.includes(id)) throw new Error('This upgrade is not available.');
  for (const unit of run.squad) {
    const c = unit.character;
    if (id === 'rest') { unit.hp = c.stats.hp; unit.mp = c.stats.mp; }
    if (id === 'guard') { c.stats.hp += 30; unit.hp += 30; c.stats.def++; }
    if (id === 'focus' && c.class !== Class.WARRIOR) { c.stats.mp += 30; unit.mp += 30; c.stats.spatk += 2; }
    if (id === 'swift' && c.class === Class.WARRIOR) c.stats.speed += 12;
    if (id === 'satchel') c.carrying_capacity++;
    if (id === 'supplies' || id === 'satchel') c.inventory = Array.from({length: c.carrying_capacity}, () => c.class === Class.WARRIOR ? 0 : 1);
    if (id in lesson && c.class === Class.BLACK_MAGE && !c.skills.includes(lesson[id])) {
      if (c.skills.length >= 3) c.skills.shift();
      c.skills.push(lesson[id]);
    }
  }
  run.upgrades.push(id);
  run.offers = [];
  run.phase = 'ready';
  run.revision++;
}

export function towerReward(floor: number, tier: number, elite: boolean): TowerReward {
  const multiplier = (1 + (tier - 1) * 0.2) * (elite ? 1.25 : 1);
  return {gold: Math.round([20, 40, 65, 90, 120, 220][floor] * multiplier),
    xp: Math.round([30, 60, 100, 150, 210, 350][floor] * multiplier),
    items: floor === 2 ? [{type: RewardType.CONSUMABLES, id: 0, amount: 1}, {type: RewardType.CONSUMABLES, id: 1, amount: 1}] : floor === 5 ? [{type: RewardType.SPELL, id: tier % 2 ? 6 : 3, amount: 1}, {type: RewardType.EQUIPMENT, id: 5, amount: 1}] : []};
}

export interface TowerBattleResult {won: boolean; units: {hp: number; mp: number; inventory: number[]}[]}
export function finishTowerBattle(run: TowerRun, result: TowerBattleResult): TowerReward {
  if (run.phase !== 'battle' || typeof result?.won !== 'boolean' || !Array.isArray(result.units) || result.units.length !== run.squad.length) throw new Error('Invalid tower result.');
  result.units.forEach((state, index) => {
    const unit = run.squad[index];
    if (!Number.isInteger(state.hp) || state.hp < 0 || state.hp > unit.character.stats.hp || !Number.isInteger(state.mp) || state.mp < 0 || state.mp > unit.character.stats.mp || !Array.isArray(state.inventory)) throw new Error('Invalid tower resources.');
    const remaining = [...unit.character.inventory];
    for (const item of state.inventory) {
      const at = remaining.indexOf(item);
      if (at < 0) throw new Error('Invalid tower supplies.');
      remaining.splice(at, 1);
    }
    unit.character.inventory = [...state.inventory];
    unit.hp = state.hp;
    unit.mp = state.mp;
  });
  const encounter = TOWER_ENCOUNTERS[run.floor].find(item => item.id === run.path[run.floor]);
  if (!encounter) throw new Error('Invalid encounter.');
  const reward = result.won ? towerReward(run.floor, run.tier, encounter.elite) : emptyTowerReward();
  run.lastReward = reward;
  run.earned.gold += reward.gold;
  run.earned.xp += reward.xp;
  run.earned.items.push(...reward.items);
  run.gameId = null;
  if (result.won) {
    run.floor++;
    // Limited recovery prevents a mandatory healer. No regeneration during combat.
    for (const unit of run.squad) {
      unit.hp = Math.min(unit.character.stats.hp, Math.max(unit.hp, Math.ceil(unit.character.stats.hp * 0.3)) + 15);
      unit.mp = Math.min(unit.character.stats.mp, unit.mp + 15);
    }
    run.phase = run.floor === TOWER_FLOORS ? 'won' : 'choice';
    run.offers = run.phase === 'choice' ? towerOffers(run) : [];
  } else run.phase = 'lost';
  run.revision++;
  return reward;
}

// Apply only XP/levels/SP to real characters, never the expedition's temporary stats.
export function towerXP(character: {xp: number; level: number; sp: number; allTimeSP?: number}, amount: number) {
  let xp = (character.xp || 0) + amount;
  let level = character.level || 1;
  let points = 0;
  while (xp >= getXPThreshold(level)) { xp -= getXPThreshold(level); level++; points += 3 + Math.floor(level / 10); }
  return {xp, level, sp: (character.sp || 0) + points, allTimeSP: (character.allTimeSP || 0) + points};
}
