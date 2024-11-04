import { Arena } from '../../game/Arena';
import { Team } from '../../game/Team';
import { Player } from '../../game/Player';
import { PlayMode, GEN, AIAttackMode } from '@legion/shared/enums';
import { GameData, PlayerNetworkData } from '@legion/shared/interfaces';

// Mock Phaser
const mockPhaser = {
    Scene: class {},
    GameObjects: {
        Graphics: class {
            clear() {}
            fillStyle() { return this; }
            fillRect() {}
            setDepth() { return this; }
        },
        Sprite: class {
            setPosition() { return this; }
            setVisible() { return this; }
            setDepth() { return this; }
            setScale() { return this; }
            play() { return this; }
            on() { return this; }
            destroy() {}
        },
        Image: class {
            setDepth() { return this; }
            setOrigin() { return this; }
            setAlpha() { return this; }
        }
    },
    Input: {
        Keyboard: {
            KeyCodes: {
                ZERO: 48,
                NINE: 57,
                NUMPAD_ZERO: 96,
                NUMPAD_NINE: 105,
                A: 65,
                Z: 90
            }
        }
    }
};

global.Phaser = mockPhaser as any;

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({
        on: jest.fn(),
        emit: jest.fn(),
        onevent: jest.fn(),
        disconnect: jest.fn()
    }))
}));

describe('Arena', () => {
    let arena: Arena;

    beforeEach(() => {
        arena = new Arena();
        arena.add = {
            graphics: jest.fn(() => new mockPhaser.GameObjects.Graphics()),
            sprite: jest.fn(() => new mockPhaser.GameObjects.Sprite()),
            image: jest.fn(() => new mockPhaser.GameObjects.Image())
        } as any;
        arena.sound = {
            add: jest.fn(() => ({
                play: jest.fn(),
                stop: jest.fn()
            }))
        } as any;
        arena.tweens = {
            add: jest.fn(),
            killAll: jest.fn()
        } as any;
        arena.time = {
            delayedCall: jest.fn(),
            removeAllEvents: jest.fn()
        } as any;
        arena.scene = {
            stop: jest.fn()
        } as any;
        arena.cameras = {
            main: {
                width: 800,
                height: 600,
                centerX: 400,
                centerY: 300
            }
        } as any;
    });

    describe('Grid Management', () => {
        test('isSkip should correctly identify invalid grid positions', () => {
            expect(arena.isSkip(-1, 0)).toBe(true);
            expect(arena.isSkip(0, -1)).toBe(true);
            expect(arena.isSkip(20, 0)).toBe(true);
            expect(arena.isSkip(0, 9)).toBe(true);
        });

        test('isFree should return true for empty cells', () => {
            expect(arena.isFree(5, 5)).toBe(true);
        });

        test('gridToPixelCoords should convert grid coordinates to pixel coordinates', () => {
            arena.gridCorners = { startX: 100, startY: 100 };
            const { x, y } = arena.gridToPixelCoords(1, 1);
            expect(x).toBe(160); // 100 + (1 * 60) + 30
            expect(y).toBe(150); // 100 + (1 * 60) - 10
        });
    });

    describe('Game State Management', () => {
        test('initializeGame should set up game state correctly', () => {
            const mockGameData: GameData = {
                player: {
                    teamId: 1,
                    team: [],
                    player: 'Player1',
                    score: 0
                },
                opponent: {
                    teamId: 2,
                    team: [],
                    player: 'Player2',
                    score: 0
                },
                general: {
                    mode: PlayMode.TUTORIAL,
                    spectator: false,
                    reconnect: false
                },
                terrain: []
            };

            arena.initializeGame(mockGameData);
            expect(arena.playerTeamId).toBe(1);
            expect(arena.gameSettings.tutorial).toBe(true);
            expect(arena.gameSettings.spectator).toBe(false);
        });

        test('destroy should clean up resources', () => {
            arena.socket = { disconnect: jest.fn() } as any;
            arena.teamsMap = new Map();
            arena.destroy();
            expect(arena.socket.disconnect).toHaveBeenCalled();
            expect(arena.gameEnded).toBe(true);
        });
    });

    describe('Tutorial Features', () => {
        test('showFloatingHand should create and position hand sprite', () => {
            arena.showFloatingHand(100, 100, 'up');
            expect(arena.handSprite).toBeDefined();
        });

        test('hideFloatingHand should remove hand sprite', () => {
            arena.showFloatingHand(100, 100);
            arena.hideFloatingHand();
            expect(arena.handSprite).toBeNull();
        });

        test('revealHealthBars should update tutorial settings', () => {
            arena.revealHealthBars();
            expect(arena.tutorialSettings.showHealthBars).toBe(true);
        });
    });

    describe('GEN System', () => {
        test('enqueueGEN should add GEN to queue', () => {
            arena.enqueueGEN(GEN.COMBAT_BEGINS);
            expect(arena.genQueue).toContain(GEN.COMBAT_BEGINS);
        });

        test('processGENQueue should not process when already displaying', () => {
            arena.isDisplayingGEN = true;
            arena.genQueue = [GEN.COMBAT_BEGINS];
            arena.processGENQueue();
            expect(arena.genQueue).toHaveLength(1);
        });
    });
}); 