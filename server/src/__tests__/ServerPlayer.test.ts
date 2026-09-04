import { ServerPlayer } from '../ServerPlayer';
import { Team } from '../Team';
import { Class, Stat, StatusEffect, Terrain } from '@legion/shared/enums';
import { MOVEMENT_RANGE } from '@legion/shared/config';

describe('ServerPlayer', () => {
  let player: ServerPlayer;

  beforeEach(() => {
    player = new ServerPlayer(1, 'TestPlayer', 'frame1', 5, 5);
  });

  describe('constructor', () => {
    it('should initialize with correct basic properties', () => {
      expect(player.num).toBe(1);
      expect(player.name).toBe('TestPlayer');
      expect(player.frame).toBe('frame1');
      expect(player.x).toBe(5);
      expect(player.y).toBe(5);
      expect(player.distance).toBe(MOVEMENT_RANGE);
    });

    it('should initialize with default stats', () => {
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      // hp and mp are initialized via _hp and _mp properties
      expect(player._hp).toBe(0);
      expect(player._mp).toBe(0);
      expect(player.damageDealt).toBe(0);
    });

    it('should initialize status effects to zero', () => {
      expect(player.statuses[StatusEffect.FREEZE]).toBe(0);
      expect(player.statuses[StatusEffect.PARALYZE]).toBe(0);
      expect(player.statuses[StatusEffect.POISON]).toBe(0);
      expect(player.statuses[StatusEffect.BURN]).toBe(0);
    });

    it('should initialize with empty inventory and spells', () => {
      expect(player.inventory).toEqual([]);
      expect(player.spells).toEqual([]);
    });
  });

  describe('HP management', () => {
    let mockGame: any;
    let mockTeam: Team;

    beforeEach(() => {
      // Create mock game and team for broadcast methods
      mockGame = {
        broadcastHPchange: jest.fn(),
        broadcastStatusEffectChange: jest.fn(),
        checkFirstBlood: jest.fn(),
        handleTeamKill: jest.fn(),
        processDeath: jest.fn(),
      };
      mockTeam = new Team(1, mockGame);
      player.setTeam(mockTeam);
      
      player.hp = 100;
      player._hp = 100;
      player.stats = {
        [Stat.HP]: 150,
        [Stat.MP]: 50,
        [Stat.ATK]: 20,
        [Stat.DEF]: 10,
        [Stat.SPATK]: 15,
        [Stat.SPDEF]: 8,
        [Stat.SPEED]: 12,
      };
    });

    it('should return current HP', () => {
      expect(player.getHP()).toBe(100);
    });

    it('should check if player is alive', () => {
      expect(player.isAlive()).toBe(true);
      player.hp = 0;
      expect(player.isAlive()).toBe(false);
    });

    it('should check if player is dead', () => {
      expect(player.isDead()).toBe(false);
      player.hp = 0;
      expect(player.isDead()).toBe(true);
    });

    it('should calculate HP ratio correctly', () => {
      expect(player.getHPratio()).toBeCloseTo(100 / 150, 2);
      
      player.hp = 75;
      expect(player.getHPratio()).toBeCloseTo(0.5, 2);
    });

    it('should return max HP from stats', () => {
      expect(player.getMaxHP()).toBe(150);
    });

    it('should take damage correctly', () => {
      player.takeDamage(30);
      expect(player.hp).toBe(70);
    });

    it('should not go below zero HP when taking damage', () => {
      player.takeDamage(150);
      expect(player.hp).toBe(0);
    });

    it('should heal correctly', () => {
      player.hp = 50;
      player.heal(30);
      expect(player.hp).toBe(80);
    });

    it('should not exceed max HP when healing', () => {
      player.hp = 140;
      player.heal(50);
      expect(player.hp).toBe(150);
    });

    it('should check if player needs revival when dead', () => {
      player.hp = 0;
      expect(player.isDead()).toBe(true);
      expect(player.isAlive()).toBe(false);
    });
  });

  describe('MP management', () => {
    beforeEach(() => {
      player.mp = 30;
      player.stats = {
        [Stat.HP]: 100,
        [Stat.MP]: 50,
        [Stat.ATK]: 20,
        [Stat.DEF]: 10,
        [Stat.SPATK]: 15,
        [Stat.SPDEF]: 8,
        [Stat.SPEED]: 12,
      };
    });

    it('should return current MP', () => {
      expect(player.getMP()).toBe(30);
    });

    it('should return max MP from stats', () => {
      expect(player.getMaxMP()).toBe(50);
    });

    it('should consume MP correctly', () => {
      player.consumeMP(10);
      expect(player.mp).toBe(20);
    });

    it('should not go below zero MP', () => {
      player.consumeMP(50);
      expect(player.mp).toBe(0);
    });

    it('should restore MP correctly', () => {
      player.restoreMP(15);
      expect(player.mp).toBe(45);
    });

    it('should not exceed max MP when restoring', () => {
      player.restoreMP(50);
      expect(player.mp).toBe(50);
    });

    it('should check MP levels', () => {
      expect(player.mp).toBe(30);
      expect(player.mp >= 20).toBe(true);
      expect(player.mp >= 40).toBe(false);
    });
  });

  describe('XP and leveling', () => {
    beforeEach(() => {
      player.level = 1;
      player.xp = 0;
      player.stats = {
        [Stat.HP]: 100,
        [Stat.MP]: 50,
        [Stat.ATK]: 20,
        [Stat.DEF]: 10,
        [Stat.SPATK]: 15,
        [Stat.SPDEF]: 8,
        [Stat.SPEED]: 12,
      };
    });

    it('should gain XP', () => {
      player.gainXP(25);
      expect(player.xp).toBe(25);
      expect(player.earnedXP).toBe(25);
    });

    it('should return correct level', () => {
      expect(player.getLevel()).toBe(1);
    });

    it('should track XP correctly', () => {
      expect(player.xp).toBe(0);
      player.xp = 50;
      expect(player.xp).toBe(50);
    });
  });

  describe('position and movement', () => {
    it('should return current position', () => {
      expect(player.x).toBe(5);
      expect(player.y).toBe(5);
    });

    it('should update position', () => {
      player.setPosition(7, 8);
      expect(player.x).toBe(7);
      expect(player.y).toBe(8);
    });

    it('should have distance property for movement', () => {
      expect(player.distance).toBe(MOVEMENT_RANGE);
    });
  });

  describe('status effects', () => {
    it('should set status effect directly', () => {
      player.statuses[StatusEffect.POISON] = 3;
      expect(player.statuses[StatusEffect.POISON]).toBe(3);
    });

    it('should clear status effect', () => {
      player.statuses[StatusEffect.FREEZE] = 2;
      player.statuses[StatusEffect.FREEZE] = 0;
      expect(player.statuses[StatusEffect.FREEZE]).toBe(0);
    });

    it('should check if player has status effect', () => {
      expect(player.hasStatusEffect(StatusEffect.PARALYZE)).toBe(false);
      player.statuses[StatusEffect.PARALYZE] = 1;
      expect(player.hasStatusEffect(StatusEffect.PARALYZE)).toBe(true);
    });

    it('should decrement status effects using decrementStatuses', () => {
      player.statuses[StatusEffect.BURN] = 3;
      player.decrementStatuses();
      expect(player.statuses[StatusEffect.BURN]).toBe(2);
    });

    it('should check if player is frozen', () => {
      expect(player.isFrozen()).toBe(false);
      player.statuses[StatusEffect.FREEZE] = 2;
      expect(player.isFrozen()).toBe(true);
    });

    it('should check if player is paralyzed', () => {
      expect(player.isParalyzed()).toBe(false);
      player.statuses[StatusEffect.PARALYZE] = 1;
      expect(player.isParalyzed()).toBe(true);
    });
  });

  describe('stats management', () => {
    beforeEach(() => {
      player.stats = {
        [Stat.HP]: 100,
        [Stat.MP]: 50,
        [Stat.ATK]: 20,
        [Stat.DEF]: 10,
        [Stat.SPATK]: 15,
        [Stat.SPDEF]: 8,
        [Stat.SPEED]: 12,
      };
    });

    it('should return stat value', () => {
      expect(player.getStat(Stat.ATK)).toBe(20);
      expect(player.getStat(Stat.DEF)).toBe(10);
      expect(player.getStat(Stat.SPEED)).toBe(12);
    });

    it('should scale stats correctly', () => {
      player.scaleStats(1.5);
      expect(player.stats[Stat.ATK]).toBe(30);
      expect(player.stats[Stat.DEF]).toBe(15);
      expect(player.stats[Stat.SPEED]).toBe(18);
    });

    it('should access stats via Stat enum', () => {
      expect(player.stats[Stat.HP]).toBe(100);
      expect(player.stats[Stat.MP]).toBe(50);
    });
  });

  describe('team assignment', () => {
    it('should set team correctly', () => {
      const mockGame = {} as any;
      const team = new Team(1, mockGame);
      
      player.setTeam(team);
      expect(player.team).toBe(team);
    });

    it('should access team directly', () => {
      const mockGame = {} as any;
      const team = new Team(1, mockGame);
      player.setTeam(team);
      
      expect(player.team).toBe(team);
    });
  });

  describe('interaction tracking', () => {
    it('should track interacted targets', () => {
      const enemy1 = new ServerPlayer(2, 'Enemy1', 'frame2', 1, 1);
      const enemy2 = new ServerPlayer(3, 'Enemy2', 'frame3', 2, 2);

      player.addInteractedTarget(enemy1);
      player.addInteractedTarget(enemy2);

      expect(player.countInteractedTargets()).toBe(2);
    });

    it('should not count same target twice', () => {
      const enemy = new ServerPlayer(2, 'Enemy', 'frame2', 1, 1);

      player.addInteractedTarget(enemy);
      player.addInteractedTarget(enemy);

      expect(player.countInteractedTargets()).toBe(1);
    });
  });

  describe('damage tracking', () => {
    it('should track damage dealt', () => {
      expect(player.damageDealt).toBe(0);
      player.damageDealt += 50;
      expect(player.damageDealt).toBe(50);
      player.damageDealt += 30;
      expect(player.damageDealt).toBe(80);
    });

    it('should access damage dealt directly', () => {
      player.damageDealt = 100;
      expect(player.damageDealt).toBe(100);
    });
  });

  describe('action state', () => {
    it('should track if player has acted', () => {
      expect(player.hasActed).toBe(false);
      player.hasActed = true;
      expect(player.hasActed).toBe(true);
    });

    it('should reset acted state', () => {
      player.hasActed = true;
      player.hasActed = false;
      expect(player.hasActed).toBe(false);
    });
  });

  describe('casting state', () => {
    it('should track casting state', () => {
      expect(player.isCasting).toBe(false);
      player.isCasting = true;
      expect(player.isCasting).toBe(true);
    });
  });
});
