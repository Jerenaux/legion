import { Team } from '../Team';
import { ServerPlayer } from '../ServerPlayer';
import { Game } from '../Game';
import { Server } from 'socket.io';
import { PlayMode, League, Class, StatusEffect, Stat } from '@legion/shared/enums';

// Create a concrete test implementation of the abstract Game class
class TestGame extends Game {
  async populateTeams(): Promise<void> {
    // Mock implementation for testing
  }
}

describe('Team', () => {
  let team: Team;
  let mockGame: TestGame;
  let mockIo: jest.Mocked<Server>;

  beforeEach(() => {
    mockIo = {} as jest.Mocked<Server>;
    mockGame = new TestGame('test-game-id', PlayMode.PRACTICE, League.BRONZE, mockIo);
    mockGame.emitScoreChange = jest.fn();
    team = new Team(1, mockGame);
  });

  describe('constructor', () => {
    it('should initialize with correct id and game reference', () => {
      expect(team.id).toBe(1);
      expect(team.game).toBe(mockGame);
      expect(team.members).toEqual([]);
      expect(team.score).toBe(0);
    });

    it('should initialize with a random AI name', () => {
      const aiNames = ['Aureus', 'Sovereign', 'Sentinel', 'Praetorian', 'Centurion', 'Gladius', 'Phalanx'];
      expect(aiNames).toContain(team.teamData.playerName);
    });
  });

  describe('addMember', () => {
    it('should add a player to the team', () => {
      const player = new ServerPlayer(1, 'TestPlayer', 'frame1', 0, 0);
      team.addMember(player);

      expect(team.members.length).toBe(1);
      expect(team.members[0]).toBe(player);
      expect(player.team).toBe(team);
    });

    it('should update total HP and level when adding members', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      player1.hp = 100;
      player1.level = 5;

      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      player2.hp = 150;
      player2.level = 7;

      team.addMember(player1);
      team.addMember(player2);

      expect(team.hpTotal).toBe(250);
      expect(team.levelTotal).toBe(12);
    });
  });

  describe('isDefeated', () => {
    it('should return false when team has no members', () => {
      expect(team.isDefeated()).toBe(false);
    });

    it('should return false when at least one member is alive', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      player1.hp = 100;
      player2.hp = 0;

      team.addMember(player1);
      team.addMember(player2);

      expect(team.isDefeated()).toBe(false);
    });

    it('should return true when all members are dead', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      player1.hp = 0;
      player2.hp = 0;

      team.addMember(player1);
      team.addMember(player2);

      expect(team.isDefeated()).toBe(true);
    });
  });

  describe('score management', () => {
    it('should increment score correctly', () => {
      team.incrementScore(100);
      expect(team.score).toBe(100);

      team.incrementScore(50);
      expect(team.score).toBe(150);
    });

    it('should cap score at MAX_AUDIENCE_SCORE', () => {
      const MAX_SCORE = 1500; // From config
      team.incrementScore(2000);
      expect(team.score).toBe(MAX_SCORE);
    });

    it('should increase score from damage', () => {
      team.increaseScoreFromDamage(50);
      expect(team.score).toBe(50);
    });

    it('should calculate multi-hit bonus correctly', () => {
      const initialScore = team.score;
      team.increaseScoreFromMultiHits(3);
      expect(team.score).toBeGreaterThan(initialScore);
      
      // Multi-hit formula: Math.pow(6, amount)
      expect(team.score).toBe(Math.pow(6, 3));
    });

    it('should not increase score for single hit in multi-hit calculation', () => {
      team.increaseScoreFromMultiHits(1);
      expect(team.score).toBe(0);
    });

    it('should increase score from kill', () => {
      const player = new ServerPlayer(1, 'Enemy', 'frame1', 0, 0);
      player.hp = 0;
      player.stats = {
        [Stat.HP]: 100,
        [Stat.MP]: 50,
        [Stat.ATK]: 10,
        [Stat.DEF]: 5,
        [Stat.SPATK]: 8,
        [Stat.SPDEF]: 4,
        [Stat.SPEED]: 6
      };
      
      const initialScore = team.score;
      team.increaseScoreFromKill(player);
      expect(team.score).toBeGreaterThan(initialScore);
    });

    it('should emit score change when score increases', () => {
      team.snapshotScore();
      team.incrementScore(100);
      team.sendScore();

      expect(mockGame.emitScoreChange).toHaveBeenCalledWith(team);
    });

    it('should not emit score change when score unchanged', () => {
      team.snapshotScore();
      team.sendScore();

      expect(mockGame.emitScoreChange).not.toHaveBeenCalled();
    });
  });

  describe('XP distribution', () => {
    it('should distribute XP based on interaction ratio', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      // Initialize players with some stats for XP gain
      player1.level = 1;
      player1.xp = 0;
      player2.level = 1;
      player2.xp = 0;
      
      const enemy = new ServerPlayer(3, 'Enemy', 'frame3', 2, 2);
      
      player1.interactedTargets.add(enemy);
      player1.interactedTargets.add(enemy); // Doesn't matter, Set only stores unique
      player2.interactedTargets.add(enemy);

      team.addMember(player1);
      team.addMember(player2);

      team.distributeXp(100);

      // Both players should receive XP since both interacted
      expect(player1.earnedXP).toBeGreaterThan(0);
      expect(player2.earnedXP).toBeGreaterThan(0);
      // Total earned XP should equal distributed XP
      expect(player1.earnedXP + player2.earnedXP).toBeLessThanOrEqual(100);
    });

    it('should give no XP to players who did not interact', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      const enemy = new ServerPlayer(3, 'Enemy', 'frame3', 2, 2);
      player1.interactedTargets.add(enemy);

      team.addMember(player1);
      team.addMember(player2);

      team.distributeXp(100);

      expect(player1.earnedXP).toBeGreaterThan(0);
      expect(player2.earnedXP).toBe(0);
    });
  });

  describe('engagement tracking', () => {
    it('should track offensive actions', () => {
      expect(team.offensiveActions).toBe(0);
      team.incrementOffensiveActions();
      expect(team.offensiveActions).toBe(1);
    });

    it('should track spell casts', () => {
      expect(team.spellCasts).toBe(0);
      team.incrementSpellCasts();
      expect(team.spellCasts).toBe(1);
      expect(team.anySpellsUsed()).toBe(true);
    });

    it('should track item usage', () => {
      expect(team.itemsUsed).toBe(0);
      team.incrementItemsUsed();
      expect(team.itemsUsed).toBe(1);
      expect(team.anyItemsUsed()).toBe(true);
    });

    it('should track movements', () => {
      expect(team.movements).toBe(0);
      team.incrementMoved();
      expect(team.movements).toBe(1);
    });

    it('should track status effects', () => {
      team.incrementFlames();
      team.incrementIce();
      team.incrementPoison();
      team.incrementSilenced();
      team.incrementParalyzed();

      expect(team.flames).toBe(1);
      expect(team.ice).toBe(1);
      expect(team.poison).toBe(1);
      expect(team.silenced).toBe(1);
      expect(team.paralyzed).toBe(1);
    });

    it('should return correct engagement object', () => {
      team.incrementSpellCasts();
      team.incrementMoved();
      team.incrementFlames();

      const engagement = team.getEngagement();

      expect(engagement.spellsUsed).toBe(true);
      expect(engagement.movements).toBe(true);
      expect(engagement.flames).toBe(true);
      expect(engagement.itemsUsed).toBe(false);
      expect(engagement.attacks).toBe(false);
    });
  });

  describe('HP tracking', () => {
    it('should calculate total HP correctly', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      player1.hp = 100;
      player2.hp = 150;

      team.addMember(player1);
      team.addMember(player2);

      expect(team.getTotalHP()).toBe(250);
    });

    it('should calculate HP left correctly', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      const player2 = new ServerPlayer(2, 'Player2', 'frame2', 1, 1);
      
      player1.hp = 50;
      player2.hp = 75;

      team.addMember(player1);
      team.addMember(player2);

      expect(team.getHPLeft()).toBe(125);
    });

    it('should track healing', () => {
      team.incrementHealing(50);
      expect(team.getHealedAmount()).toBe(50);
      
      team.incrementHealing(30);
      expect(team.getHealedAmount()).toBe(80);
    });
  });

  describe('kill streak', () => {
    it('should increment kill streak', () => {
      expect(team.killStreak).toBe(0);
      team.incrementKillStreak();
      expect(team.killStreak).toBe(1);
      team.incrementKillStreak();
      expect(team.killStreak).toBe(2);
    });

    it('should reset kill streak', () => {
      team.incrementKillStreak();
      team.incrementKillStreak();
      expect(team.killStreak).toBe(2);
      
      team.resetKillStreak();
      expect(team.killStreak).toBe(0);
    });
  });

  describe('player data', () => {
    it('should set player data correctly', () => {
      const playerData = {
        uid: 'test-uid',
        elo: 1200,
        lvl: 10,
        name: 'TestPlayer',
        teamName: 'TestTeam',
        avatar: 'avatar1',
        league: League.SILVER,
        rank: 5,
        dailyloot: null,
        AIwinRatio: 0.6,
        completedGames: 25,
        engagementStats: {},
      };

      team.setPlayerData(playerData);

      expect(team.teamData.playerUID).toBe('test-uid');
      expect(team.teamData.elo).toBe(1200);
      expect(team.teamData.playerName).toBe('TestPlayer');
      expect(team.getElo()).toBe(1200);
    });

    it('should return correct player data', () => {
      team.teamData.teamName = 'Warriors';
      team.teamData.playerName = 'Hero';
      team.teamData.lvl = 15;

      const data = team.getPlayerData();

      expect(data.teamName).toBe('Warriors');
      expect(data.playerName).toBe('Hero');
      expect(data.playerLevel).toBe(15);
    });
  });

  describe('character updates', () => {
    it('should return character DB updates', () => {
      const player1 = new ServerPlayer(1, 'Player1', 'frame1', 0, 0);
      player1.dbId = 'char-1';
      player1.earnedStatsPoints = 5;
      player1.xp = 100;
      player1.earnedXP = 50;
      player1.levelsGained = 2;

      team.addMember(player1);

      const updates = team.getCharactersDBUpdates();

      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        id: 'char-1',
        num: 1,
        points: 5,
        xp: 100,
        earnedXP: 50,
        level: 2,
      });
    });
  });
});
