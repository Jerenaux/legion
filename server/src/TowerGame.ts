import {Socket, Server} from 'socket.io';
import {AIGame} from './AIGame';
import {ServerPlayer} from './ServerPlayer';
import {AIServerPlayer} from './AIServerPlayer';
import {apiFetch} from './API';
import {Class, League, PlayMode, SpeedClass, StatusEffect, Terrain} from '@legion/shared/enums';
import {TOWER_ENCOUNTERS, TowerRun, towerCharacter, TowerBattleResult} from '@legion/shared/tower';
import {getTilesInHexRadius, isSkip} from '@legion/shared/utils';
import {remoteConfig} from '@legion/shared/config';

export class TowerGame extends AIGame {
  private frozenTurns = new Map<ServerPlayer, number>();
  private result: TowerBattleResult | null = null;
  private saving: Promise<void> | null = null;
  private saved = false;
  private warning: {x: number; y: number}[] = [];

  constructor(id: string, mode: PlayMode, league: League, io: Server, readonly run: TowerRun) {
    super(id, mode, league, io);
  }

  get hasPendingResult() { return this.result !== null; }

  // Fixed encounter rules do not inherit tutorial cheats or adaptive practice difficulty.
  async getRemoteConfig() { this.config = {...remoteConfig, AUTO_WIN: false, AUTO_DEFEAT: false, HIGH_DAMAGE: false}; }
  isGame0() { return false; }
  async incrementStartedGames() {}
  async updateGameInDB() {} // Checkpoint settlement owns the game receipt, including retries.
  async saveInventoryToDb() {}
  async saveGameAction() {}
  async saveReplayToDb() {} // Runs use durable encounter checkpoints rather than match replays.

  async populateTeams() {
    this.turnDuration = 0; // Untimed turns; paralysis and AI still use the combat clock.
    const allies = this.teams.get(1)!;
    const enemies = this.teams.get(2)!;
    const encounter = TOWER_ENCOUNTERS[this.run.floor].find(item => item.id === this.run.path[this.run.floor])!;
    enemies.teamData.playerName = encounter.name;
    enemies.teamData.AIwinRatio = 0.8;
    this.run.squad.forEach((unit, index) => {
      const player = new ServerPlayer(index + 1, unit.character.name, unit.character.portrait, index === 0 ? 5 : 4, [5, 3, 7][index]);
      player.setUpCharacter(unit.character);
      player.hp = unit.hp; player.mp = unit.mp;
      if (this.run.upgrades.includes('swift') && player.class === Class.WARRIOR) player.distance++;
      if (this.run.upgrades.includes('frostcraft')) {
        const spell = player.spells.find(candidate => candidate.id === 6);
        if (spell) {
          spell.cost = Math.max(5, spell.cost - 15);
          spell.effects = spell.effects.map(effect => ({...effect, value: effect.value / 2}));
        }
      }
      allies.addMember(player);
    });
    encounter.enemies.forEach((enemy, index) => {
      const data = towerCharacter(enemy.class, enemy.name);
      const multiplier = 1 + (this.run.tier - 1) * 0.15;
      data.stats.hp = Math.round(enemy.hp * multiplier);
      data.stats.atk = Math.round((enemy.class === Class.WARRIOR ? 9 + this.run.floor : 4) * multiplier);
      data.stats.spatk = Math.round((4 + this.run.floor) * multiplier);
      data.stats.mp = 100;
      data.stats.speed = enemy.boss ? 12 : 16 + this.run.floor;
      data.skills = enemy.spells;
      data.inventory = [];
      const player = enemy.boss ? new TowerWarden(index + 1, data.name, data.portrait, enemy.x, enemy.y) :
        new AIServerPlayer(index + 1, data.name, data.portrait, enemy.x, enemy.y);
      player.setUpCharacter(data, true);
      enemies.addMember(player);
    });
    encounter.terrain.forEach(tile => { this.terrainManager.updateTerrainMap(tile.terrain, tile.x, tile.y); });
  }

  resetTurnTimer() {
    this.turnStart = this.combatClock.now(); this.turnDuration = 0;
    const unit = this.turnee;
    if (unit?.isFrozen()) {
      const skipped = this.frozenTurns.get(unit) || 0;
      if (skipped >= 2) {
        this.broadcastTerrain(this.terrainManager.removeIce(unit.x, unit.y));
        unit.removeStatusEffect(StatusEffect.FREEZE);
        this.frozenTurns.delete(unit);
      } else this.frozenTurns.set(unit, skipped + 1);
    } else if (unit) this.frozenTurns.delete(unit);
    // Existing AI can fail to find a legal move. Human decisions have no deadline.
    if (this.turnee?.team.id === 2) this.turnTimer = this.combatClock.schedule(() => this.processTurn(), 5000);
  }

  getGameData(teamId: number, reconnect = false) {
    const data = super.getGameData(teamId, reconnect);
    data.general.tower = {floor: this.run.floor + 1, tier: this.run.tier,
      name: TOWER_ENCOUNTERS[this.run.floor].find(item => item.id === this.run.path[this.run.floor])!.name,
      warning: this.warning};
    // Suppress first-account-match onboarding for the temporary expedition squad.
    data.player.player.completedGames = Math.max(1, data.player.player.completedGames);
    data.player.team.forEach((unit, index) => {
      const spells = this.getTeam(1)[index].spells;
      unit.towerSpellCosts = Object.fromEntries(spells.map(spell => [spell.id, spell.cost]));
    });
    return data;
  }

  setWarning(tiles: {x: number; y: number}[]) {
    this.warning = tiles;
    this.broadcast('towerWarning', tiles);
  }

  startGame() {
    const boss = this.getTeam(2).find(unit => unit instanceof TowerWarden) as TowerWarden | undefined;
    boss?.markBlast(); // Included in the initial snapshot, before any human input.
    super.startGame();
  }

  endGame(winner: number) {
    if (this.gameOver) return;
    if (!this.combatStarted) { super.endGame(winner); return; }
    this.gameOver = true;
    this.endedAt = Date.now();
    this.clearTimers();
    this.result = {won: winner === 1, units: this.getTeam(1).map(unit => ({hp: unit.hp, mp: unit.mp, inventory: unit.getNetworkInventory()}))};
    void this.saveResult();
  }

  private async saveResult() {
    if (this.saving || !this.result) return this.saving;
    this.saving = (async () => {
      try {
        await apiFetch('towerResult', '', {method: 'POST', body: {gameId: this.id, result: this.result}}, 5, 1000);
        this.saved = true;
        this.broadcast('towerEnd', {saved: true});
      } catch (error) {
        console.error('Tower reward save failed', error);
        this.broadcast('joinError', {message: 'Your battle has ended. Reload to retry saving the expedition.'});
      } finally { this.saving = null; }
    })();
    return this.saving;
  }

  reconnectPlayer(socket: Socket) {
    super.reconnectPlayer(socket);
    if (this.saved) socket.emit('towerEnd', {saved: true});
    else if (this.result) void this.saveResult();
  }
}

// A readable boss: a fixed warning survives every intervening human/AI turn.
class TowerWarden extends AIServerPlayer {
  private blast: {x: number; y: number}[] = [];
  markBlast() {
    const targets = this.team.game.getTeam(1).filter(unit => unit.isAlive());
    const target = targets.sort((a, b) => a.hp - b.hp)[0];
    this.blast = target ? getTilesInHexRadius(target.x, target.y, 1).filter(tile => !isSkip(tile.x, tile.y)) : [];
    (this.team.game as TowerGame).setWarning(this.blast);
  }
  takeAction() {
    if (!this.canAct()) return 0;
    const game = this.team.game as TowerGame;
    for (const tile of this.blast) {
      const target = game.getPlayerAt(tile.x, tile.y);
      if (target?.team.id === 1) target.takeDamage(35 + game.run.tier * 5);
      game.terrainManager.updateTerrainMap(Terrain.FIRE, tile.x, tile.y);
      game.terrainManager.postProcessing(tile.x, tile.y);
    }
    game.broadcastTerrain(this.blast.map(tile => game.terrainManager.getTerrainUpdate(tile.x, tile.y)));
    this.setHasActed(true);
    game.turnSystem.processAction(this, SpeedClass.SLOW);
    this.markBlast();
    game.checkEndGame();
    game.processTurn(1);
    return 0;
  }
  die() {
    super.die();
    (this.team.game as TowerGame).setWarning([]);
  }
}
