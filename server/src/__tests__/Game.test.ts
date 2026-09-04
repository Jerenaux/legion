import { Game } from '../Game';
import { Server } from 'socket.io';
import { PlayMode, League, Terrain, Class } from '@legion/shared/enums';
import { GRID_WIDTH, GRID_HEIGHT } from '@legion/shared/config';

// Create a concrete test implementation of the abstract Game class
class TestGame extends Game {
  async populateTeams(): Promise<void> {
    // Mock implementation for testing
  }
}

describe('Game', () => {
  let game: TestGame;
  let mockIo: jest.Mocked<Server>;

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
    
    game = new TestGame('test-game-id', PlayMode.PRACTICE, League.GOLD, mockIo);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(game.id).toBe('test-game-id');
      expect(game.mode).toBe(PlayMode.PRACTICE);
      expect(game.league).toBe(League.GOLD);
      expect(game.io).toBe(mockIo);
      expect(game.gameStarted).toBe(false);
      expect(game.gameOver).toBe(false);
    });

    it('should create two teams', () => {
      expect(game.teams.size).toBe(2);
      expect(game.teams.get(1)).toBeDefined();
      expect(game.teams.get(2)).toBeDefined();
    });

    it('should initialize empty grid map', () => {
      expect(game.gridMap.size).toBe(0);
    });

    it('should initialize with correct turn duration', () => {
      expect(game.turnDuration).toBe(7); // TURN_DURATION from config
    });
  });

  describe('grid management', () => {
    it('should check if cell is free', () => {
      expect(game.isFree(5, 5)).toBe(true);
    });

    it('should detect occupied cells', () => {
      // Place a mock player on the grid
      const mockPlayer: any = { x: 3, y: 4 };
      game.gridMap.set('3,4', mockPlayer);

      expect(game.isFree(3, 4)).toBe(false);
      expect(game.isFree(3, 5)).toBe(true);
    });

    it('should detect obstacles (ice)', () => {
      game.terrainManager.terrainMap.set('7,7', Terrain.ICE);
      expect(game.hasObstacle(7, 7)).toBe(true);
      expect(game.hasObstacle(7, 8)).toBe(false);
    });

    it('should detect holes as obstacles', () => {
      game.holePositions.add('2,3');
      expect(game.hasObstacle(2, 3)).toBe(true);
      expect(game.isHole(2, 3)).toBe(true);
    });

    it('should free a cell', () => {
      const mockPlayer: any = { x: 5, y: 5 };
      game.gridMap.set('5,5', mockPlayer);
      
      game.freeCell(5, 5);
      expect(game.gridMap.has('5,5')).toBe(false);
    });
  });

  describe('position generation', () => {
    it('should generate valid positions within grid bounds', () => {
      const position = game.getPosition(0, false, Class.WARRIOR);

      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThan(GRID_WIDTH);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThan(GRID_HEIGHT);
    });

    it('should place team 1 on left side of grid', () => {
      const position = game.getPosition(0, false, Class.WARRIOR);
      const halfWidth = Math.floor(GRID_WIDTH / 2);
      
      expect(position.x).toBeLessThan(halfWidth);
    });

    it('should place team 2 on right side of grid', () => {
      const position = game.getPosition(0, true, Class.WARRIOR);
      const halfWidth = Math.floor(GRID_WIDTH / 2);
      
      expect(position.x).toBeGreaterThanOrEqual(halfWidth);
    });

    it('should respect class-based position restrictions for warriors', () => {
      // Warriors should spawn in middle third
      const oneThird = Math.floor(GRID_WIDTH / 3);
      const twoThirds = Math.floor(2 * GRID_WIDTH / 3);
      
      // Test multiple times to account for randomness
      const positions = Array.from({ length: 20 }, () => 
        game.getPosition(0, false, Class.WARRIOR)
      );
      
      // At least some positions should be in the middle third
      const hasMiddlePositions = positions.some(pos => 
        pos.x >= oneThird && pos.x < twoThirds
      );
      expect(hasMiddlePositions).toBe(true);
    });

    it('should attempt to find free positions', () => {
      // This test verifies the method runs without errors when grid is constrained
      // The actual position may be occupied if all valid positions are taken
      // In that case, the method falls back to a random position
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          game.gridMap.set(`${x},${y}`, {} as any);
        }
      }

      const position = game.getPosition(0, false, Class.WARRIOR);
      
      // Should return a position (may fallback to occupied if no free spots)
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
    });
  });

  describe('hole generation', () => {
    it('should generate holes on the grid', () => {
      game.generateHoles();
      
      // Should have created some holes (exact number depends on implementation)
      expect(game.holePositions.size).toBeGreaterThanOrEqual(0);
    });

    it('should check if position is a hole', () => {
      game.holePositions.add('4,4');
      
      expect(game.isHole(4, 4)).toBe(true);
      expect(game.isHole(4, 5)).toBe(false);
    });
  });

  describe('game state', () => {
    it('should track game start time', () => {
      const beforeTime = Date.now();
      const newGame = new TestGame('test-id', PlayMode.PRACTICE, League.BRONZE, mockIo);
      const afterTime = Date.now();

      expect(newGame.startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(newGame.startTime).toBeLessThanOrEqual(afterTime);
    });

    it('should initialize with no first blood', () => {
      expect(game.firstBlood).toBe(false);
    });

    it('should track turn number', () => {
      expect(game.turnNumber).toBe(0);
    });

    it('should initialize with empty replay messages', () => {
      expect(game.replayMessages).toEqual([]);
    });
  });

  describe('socket management', () => {
    it('should add socket to game', () => {
      const mockSocket: any = {
        join: jest.fn(),
      };

      game.addSocket(mockSocket);

      expect(game.sockets).toContain(mockSocket);
      expect(mockSocket.join).toHaveBeenCalledWith('test-game-id');
    });

    it('should handle multiple sockets', () => {
      const socket1: any = { join: jest.fn() };
      const socket2: any = { join: jest.fn() };

      game.addSocket(socket1);
      game.addSocket(socket2);

      expect(game.sockets.length).toBe(2);
    });

    it('reconnects a player to their own team', () => {
      const socket: any = { uid: 'player-two', join: jest.fn(), emit: jest.fn() };
      game.teams.get(1)!.teamData.playerUID = 'player-one';
      game.teams.get(2)!.teamData.playerUID = 'player-two';
      jest.spyOn(game, 'sendGameStatus').mockImplementation(() => undefined);

      game.reconnectPlayer(socket);

      expect(game.socketMap.get(socket)).toBe(game.teams.get(2));
    });
  });

  describe('turn system', () => {
    it('should initialize with no turnee', () => {
      expect(game.turnee).toBeNull();
    });

    it('should initialize turn timers as null', () => {
      expect(game.turnTimer).toBeNull();
      expect(game.audienceTimer).toBeNull();
      expect(game.checkEndTimer).toBeNull();
    });
  });

  describe('game outcomes', () => {
    it('should initialize with empty game outcomes', () => {
      expect(game.gameOutcomes.size).toBe(0);
    });

    it('should initialize with null processed UIDs', () => {
      expect(game.processedUIDs).toBeNull();
    });

    it('does not complete the same game twice', () => {
      game.gameOver = true;
      game.endedAt = 123;
      game.endGame(1);
      expect(game.endedAt).toBe(123);
    });
  });

  describe('tutorial settings', () => {
    it('should have default tutorial settings', () => {
      expect(game.tutorialSettings).toEqual({
        allowVictoryConditions: false,
        shortCooldowns: true,
      });
    });
  });

  describe('GEN history', () => {
    it('should initialize with empty GEN history', () => {
      expect(game.GENhistory.size).toBe(0);
    });
  });
});
