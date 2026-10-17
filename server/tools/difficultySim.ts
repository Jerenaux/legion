// biome-ignore-all lint/suspicious/noExplicitAny: --old loads pre-#142 code, whose APIs differ from the current types.
// Calibrates adaptive AI difficulty: a player-proxy AI team fights generated AI teams at each
// difficulty tier through the production Game, turn system, spells and AI decision code.
// Usage (from server): bun tools/difficultySim.ts [--games=N] [--levels=1,5,12,20] [--skill=0.5] [--scales=easy,normal,hard,elite] [--tiers=0.05,0.2,0.45,0.75,0.95]
// --old runs a copy of the code from before a change that lacks AIGame.applyDifficulty (pre-#142).
// Each cell is the player proxy's score: wins plus half the matches stalled after 1,500 activations.
import {Server} from 'socket.io';
import {Class, League, PlayMode} from '@legion/shared/enums';
import {NewCharacter} from '@legion/shared/NewCharacter';
import * as AIGameModule from '../src/AIGame';
import {TurnSystem} from '../src/TurnSystem';

const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const GAMES = Number(arg('games', '200'));
const LEVELS = arg('levels', '1,5,12,20').split(',').map(Number);
const SKILL = Number(arg('skill', '0.5'));
const PRODUCTION = (AIGameModule as any).DIFFICULTY_STAT_SCALES;
const SCALES = arg('scales', PRODUCTION ? `${PRODUCTION.easy},${PRODUCTION.normal},${PRODUCTION.hard},${PRODUCTION.elite}` : '0.78,0.92,0.93,1.2').split(',').map(Number);
if (PRODUCTION) Object.assign(PRODUCTION, {easy: SCALES[0], normal: SCALES[1], hard: SCALES[2], elite: SCALES[3]});
const OLD = process.argv.includes('--old');
const TIERS = arg('tiers', '0.05,0.2,0.45,0.75,0.95').split(',').map(Number);
console.log = () => {};
const report = (...values: unknown[]) => process.stdout.write(values.join(' ') + '\n');

const {AIGame} = AIGameModule;
class SimGame extends AIGame {
  async populateTeams() {}
  broadcast() {}
  broadcastQueueData() {}
  saveGameAction() { return Promise.resolve(); }
  saveInventoryToDb() { return Promise.resolve(); }
}

const io = new Server();
// Pre-#142 copy of the tier rules, for code that predates AIGame.applyDifficulty.
function applyTier(game: SimGame, team, winRatio: number, scales: number[]) {
  team.addWinRatio(winRatio);
  if (winRatio <= 0.1) team.scaleStats(0.5);
  if (winRatio <= 0.3) { team.disableItems(); team.banSpells([3, 4, 5, 6, 7, 8]); team.disableStatusEffects(); }
  else if (winRatio <= 0.6) team.banSpells([6, 7, 8]);
  team.scaleStats(winRatio <= 0.3 ? scales[0] : winRatio <= 0.6 ? scales[1] : scales[2]);
  if (winRatio > 0.9) { game.addExtraTeamMember(team); team.scaleStats(scales[3]); }
}

function character(characterClass: Class, level: number) {
  // Before #142 the signature was (class, level, unicornBonus, isAI).
  return (OLD ? new (NewCharacter as any)(characterClass, level, false, true) : new NewCharacter(characterClass, level, true)).getCharacterData();
}

function play(level: number, tier: number, scales: number[]): 1 | 2 | 0 {
  const game = new SimGame(`sim-${Math.random()}`, PlayMode.CASUAL_VS_AI, League.BRONZE, io);
  const scheduled: (() => void)[] = [];
  (game.combatClock as any).schedule = (callback: () => void) => { scheduled.push(callback); return scheduled.length; };
  const [proxy, ai] = [game.teams.get(1)!, game.teams.get(2)!];
  [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].forEach((characterClass, index) => {
    game.addAICharacter(proxy, character(characterClass, level), game.getPosition(index, false, characterClass));
  });
  proxy.teamData.AIwinRatio = SKILL;
  game.createAITeam(ai, 3, [level, level, level]);
  if (typeof (game as any).applyDifficulty === 'function') (game as any).applyDifficulty(ai, tier);
  else applyTier(game, ai, tier, scales);
  game.gameStarted = true;
  game.config = {};
  game.turnSystem = new TurnSystem();
  game.turnSystem.initializeTurnOrder([...proxy.getMembers(), ...ai.getMembers()]);
  for (let activations = 0; activations < 1500; activations++) {
    if (proxy.isDefeated() || ai.isDefeated()) break;
    const actor = game.turnSystem.getNextActor();
    if (!actor) break;
    game.turnee = actor;
    actor.hasActed = false;
    scheduled.length = 0;
    actor.startTurn();
    if (actor.canAct() && !actor.hasActed) (actor as any).takeAction();
    while (scheduled.length) scheduled.shift()!();
    (actor as any).endTurn?.(); // Before #142, startTurn also ended the previous activation.
  }
  return proxy.isDefeated() ? 2 : ai.isDefeated() ? 1 : 0;
}

report(`${OLD ? 'pre-#142' : 'current'} skill=${SKILL} scales=${SCALES.join('/')} games=${GAMES}`);
report('level\t' + TIERS.map(t => `r=${t}`).join('\t') + '\t(player score %)');
for (const level of LEVELS) {
  const row = TIERS.map(tier => {
    let score = 0;
    for (let i = 0; i < GAMES; i++) { const winner = play(level, tier, SCALES); score += winner === 1 ? 1 : winner ? 0 : 0.5; }
    return Math.round(100 * score / GAMES);
  });
  report(`${level}\t${row.join('\t')}`);
}
io.close();
process.exit(0);
