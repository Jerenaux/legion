import { io } from 'socket.io-client';
import { Player } from './Player';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { Team } from './Team';
import { MusicManager } from './MusicManager';
import { getSpellById } from '@legion/shared/Spells';
import { serializeCoords, hexDistance } from '@legion/shared/utils';
import { getFirebaseIdToken } from '../services/apiService';
import { allSprites } from '@legion/shared/sprites';
import { Target, Terrain, GEN, AIAttackMode, TargetHighlight } from "@legion/shared/enums";
import { TerrainUpdate, GameData, OutcomeData, PlayerNetworkData } from '@legion/shared/interfaces';
import { KILL_CAM_DURATION, BASE_ANIM_FRAME_RATE, FREEZE_CAMERA, GRID_WIDTH, GRID_HEIGHT } from '@legion/shared/config';

import killzoneImage from '@assets/killzone.png';
import iceblockImage from '@assets/iceblock.png';

import potionHealImage from '@assets/vfx/potion_heal.png';
import explosionsImage from '@assets/vfx/explosions.png';
import smokeImage from '@assets/vfx/smoke.png';
import thunderImage from '@assets/vfx/thunder.png';
import castImage from '@assets/vfx/cast.png';
import slashImage from '@assets/vfx/slash.png';
import boltsImage from '@assets/vfx/bolts.png';
import iceImage from '@assets/vfx/ice.png';
import ice2Image from '@assets/vfx/ice2.png';
import impactImage from '@assets/vfx/sword_impact.png';
import poisonImage from '@assets/vfx/poison.png';
import muteImage from '@assets/vfx/mute.png';
import handImage from '@assets/hand.png';
import reviveImage from '@assets/vfx/revive.png';

import statusesImage from '@assets/States.png';

import clickSFX from '@assets/sfx/click_2.wav';
import slashSFX from '@assets/sfx/swish_2.wav';
import stepsSFX from '@assets/sfx/steps.wav';
import nopeSFX from '@assets/sfx/nope.wav';
import heartSFX from '@assets/sfx/heart.wav';
import cooldownSFX from '@assets/sfx/cooldown.wav';
import shatterSFX from '@assets/sfx/shatter.wav';
import flamesSFX from '@assets/sfx/flame.wav';
import crowdSFX from '@assets/sfx/crowd.wav';
import castSoundSFX from '@assets/sfx/spells/cast.wav';
import fireballSFX from '@assets/sfx/spells/fire_3.wav';
import thunderSoundSFX from '@assets/sfx/spells/thunder.wav';
import iceSoundSFX from '@assets/sfx/spells/ice.wav';
import healingSFX from '@assets/sfx/spells/healing.wav';
import reviveSFX from '@assets/sfx/spells/revive.wav';
import poisonSoundSFX from '@assets/sfx/spells/poison.wav';
import muteSoundSFX from '@assets/sfx/spells/mute.wav';
import bgmStartSFX from '@assets/music/bgm_start.wav';
import bgmEndSFX from '@assets/music/bgm_end.wav';
import thudSFX from '@assets/sfx/thud.wav';

import speechBubble from '@assets/speech_bubble.png';
import speechTail from '@assets/speech_tail.png';

import arenaBg from '@assets/arenabg.png';

import groundTilesImage from '@assets/tiles2.png';
import groundTilesAtlas from '@assets/tiles2.json';
import { errorToast, recordLoadingStep, silentErrorToast } from '../components/utils';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { BaseItem } from '@legion/shared/BaseItem';

import { HexGridManager, HighlightType } from './HexGridManager';
import { TutorialManager } from './TutorialManager';

const LOCAL_ANIMATION_SCALE = 3;
const DEPTH_OFFSET = 0.01;
export const DARKENING_INTENSITY = 0.9;
const TINT_COLOR = Math.round(0x66 * DARKENING_INTENSITY) * 0x010101;

import hexTileImage from '@assets/tile.png';

export class Arena extends Phaser.Scene
{
    gamehud;
    socket;
    HUD;
    playerTeamId;
    gridCorners;
    gridMap: Map<string, Player> = new Map<string, Player>();
    teamsMap: Map<number, Team> = new Map<number, Team>();
    selectedPlayer: Player | null = null;
    localAnimationSprite: Phaser.GameObjects.Sprite;
    obstaclesMap: Map<string, boolean> = new Map<string, boolean>();
    terrainSpritesMap: Map<string, Phaser.GameObjects.Sprite> = new Map<string, Phaser.GameObjects.Sprite>();
    terrainMap: Map<string, Terrain> = new Map<string, Terrain>();
    server;
    animationScales;
    SFX;
    overviewReady = false;
    musicManager: MusicManager;
    sprites: Phaser.GameObjects.Sprite[] = [];
    environmentalAudioSources;
    gameSettings;
    killCamActive = false;
    pendingGEN: GEN;
    genQueue: GEN[] = [];
    isDisplayingGEN: boolean = false;
    eventsQueue = [];
    isLateToTheParty = false;
    sceneCreated = false;
    gameInitialized = false;
    gameEnded = false;
    sfxVolume: number;
    inputLocked = false;
    handSprite: Phaser.GameObjects.Sprite;
    queue: any[];
    turnee: any;
    isReplay: boolean = false;
    replayData: any = null;
    replayTimer: Phaser.Time.TimerEvent = null;
    currentReplayIndex: number = 0;
    eventHandlers: Map<string, (data: any) => void>;
    isDarkened: boolean = false;
    tutorialManager: TutorialManager;
    hexGridManager: HexGridManager;

    private static readonly GEN_CONFIGS = {
        [GEN.COMBAT_BEGINS]: { text1: 'combat', text2: 'begins' },
        [GEN.MULTI_KILL]: { text1: 'multi', text2: 'kill' },
        [GEN.MULTI_HIT]: { text1: 'multi', text2: 'hit' },
        [GEN.ONE_SHOT]: { text1: 'one', text2: 'shot' },
        [GEN.FROZEN]: { text1: 'frozen', text2: null },
        [GEN.BURNING]: { text1: 'stuff-is', text2: 'on-fire' },
        [GEN.TUTORIAL]: { text1: 'tutorial', text2: null },
    };

    private static readonly SOUND_NAMES = [
        'click', 'slash', 'steps', 'nope', 'heart', 'cooldown', 'fireball',
        'healing', 'cast', 'thunder', 'ice', 'shatter', 'flames', 'crowd',
        'poison', 'mute', 'thud', 'revive'
    ];

    private isInTargetMode: boolean = false;
    private targetModeSize: number = 1;
    private targetModeListener: any;

    constructor() {
        super({ key: 'Arena' });
        this.sfxVolume = this.getSFXVolumeFromLocalStorage();
        
        // Initialize event handlers map
        const handlers = {
            gameStatus: this.initializeGame,
            move: this.processMove,
            attack: this.processAttack,
            obstacleattack: this.processObstacleAttack,
            inventory: this.processInventory,
            hpchange: this.processHPChange,
            statuseffectchange: this.processStatusChange,
            mpchange: this.processMPChange,
            useitem: this.processUseItem,
            cast: (data) => this.processCast(true, data),
            endcast: (data) => this.processCast(false, data),
            terrain: this.processTerrain,
            gen: (data) => {
                if (Array.isArray(data)) {
                    data.forEach(g => this.enqueueGEN(g));
                } else {
                    this.enqueueGEN(data.gen);
                }
            },
            localanimation: this.processLocalAnimation,
            gameEnd: this.processGameEnd,
            score: this.processScoreUpdate,
            addCharacter: this.processAddCharacter,
            queueData: this.processQueueData,
            turnee: this.processTurnee,
        };

        this.eventHandlers = new Map(
            Object.entries(handlers).map(([event, handler]) => 
                [event, handler.bind(this)]
            )
        );
    }

    lockInput() {
        this.inputLocked = true;
    }

    unlockInput() {
        this.inputLocked = false;
    }

    getSFXVolumeFromLocalStorage(): number {
        const settingsString = localStorage.getItem('gameSettings');
        if (settingsString) {
            const settings = JSON.parse(settingsString);
            return settings.sfxVolume / 100; // Convert percentage to decimal
        }
        return 0.5; // Default to 50% volume if setting is not found
    }

    preload()
    {
        // console.log('Preloading assets ...');
        this.gamehud = new GameHUD();
        
        this.load.image('killzone',  killzoneImage);
        this.load.image('iceblock',  iceblockImage);
        this.load.image('speech_bubble', speechBubble);
        this.load.image('speech_tail', speechTail);
        this.load.image('hand', handImage);
        const frameConfig = { frameWidth: 144, frameHeight: 144};
        // Iterate over assetsMap and load spritesheets
        allSprites.forEach((sprite) => {
            this.load.spritesheet(sprite, require(`@assets/sprites/${sprite}.png`), frameConfig);
        });
        this.load.spritesheet('potion_heal', potionHealImage, { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('explosions', explosionsImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder2', thunderImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('smoke', smokeImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('cast', castImage, { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('slash', slashImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder', boltsImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice', iceImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice2', ice2Image, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('impact', impactImage, { frameWidth: 291, frameHeight: 291});
        this.load.spritesheet('poison', poisonImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('mute', muteImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('statuses', statusesImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('revive', reviveImage, { frameWidth: 48, frameHeight: 64});

        this.load.audio('click', clickSFX);
        this.load.audio('slash', slashSFX);
        this.load.audio('steps', stepsSFX);
        this.load.audio('nope', nopeSFX);
        this.load.audio('heart', heartSFX);
        this.load.audio('cooldown', cooldownSFX);
        this.load.audio('shatter', shatterSFX);
        this.load.audio('flames', flamesSFX);
        this.load.audio('crowd', crowdSFX);
        // this.load.audio('cheer', cheerSFX);
        this.load.audio('thud', thudSFX);


        // Load spell sounds
        this.load.audio('cast', castSoundSFX);
        this.load.audio('fireball', fireballSFX);
        this.load.audio('thunder', thunderSoundSFX);
        this.load.audio('ice', iceSoundSFX);
        this.load.audio('healing', healingSFX);
        this.load.audio('poison', poisonSoundSFX);
        this.load.audio('mute', muteSoundSFX);
        this.load.audio('revive', reviveSFX);

        // Load music
        this.load.audio('bgm_start', bgmStartSFX);
        this.load.audio(`bgm_loop_1`, require(`@assets/music/bgm_loop_1.wav`));

        this.load.atlas('groundTiles', groundTilesImage, groundTilesAtlas);
    
        const GEN = ['gen_bg', 'begins', 'blood', 'blue_bang', 'combat', 'first', 'orange_bang', 'multi', 'kill', 
            'hit', 'one', 'shot', 'frozen', 'stuff-is', 'on-fire', 'tutorial'];
        GEN.forEach((name) => {
            this.load.image(name, require(`@assets/GEN/${name}.png`));
        });

        this.load.on('progress', (value) => {
            events.emit('progressUpdate', Math.floor(value * 100));
        });

        this.load.on('complete', () => {
            events.emit('progressUpdate', 100);
            // Remove listener
            this.load.off('progress');
            this.load.off('complete');
        });
        this.connectToServer();

        this.load.image('arenaBg', arenaBg);
        this.load.image('hexTile', hexTileImage);
    }

    extractGameIdFromUrl() {
        const pathArray = window.location.pathname.split('/');
        // Assuming the URL pattern is "/game/{gameId}", and "game" is always at a fixed position
        const gameIdIndex = pathArray.findIndex(element => element === 'game') + 1;
        return pathArray[gameIdIndex];
    }

    async connectToServer() {
        console.log('Connecting to the server ...');
        const pathParts = window.location.pathname.split('/');
        const isReplay = pathParts[1] === 'replay';
        const gameId = pathParts[2];

        this.socket = io(
            process.env.GAME_SERVER_URL,
            {
                auth: {
                    token: await getFirebaseIdToken(),
                    gameId,
                    isReplay,
                },
            }
        );

        // Queue socket events until the scene is created
        var onevent = this.socket.onevent;
        const scene = this;
        this.socket.onevent = function (packet) {
            if (!scene.sceneCreated){ // Set at the end of create()
                console.warn('queueing ',packet.data[0]);
                scene.eventsQueue.push(packet);
            } else {
                onevent.call(this, packet);    // original call
            }
        };

        // Set up socket event listeners using the event handlers map
        this.eventHandlers.forEach((handler, event) => {
            this.socket.on(event, handler);
        });

        // Add special handlers that aren't part of the regular game flow
        this.socket.on('connect', () => {
            // console.log('Connected to the server');
        });
        
        this.socket.on('disconnect', (reason) => {
            // console.log(`Disconnected from the server, ${reason}`);
            if (reason != 'io client disconnect') {
                // The disconnection was initiated by the server
                console.error(`Server disconnect during game: ${reason}`);
                silentErrorToast('Disconnected from server');
                events.emit('serverDisconnect');
                this.destroy();
            } 
        }); 

        this.socket.on('error', (error) => {
            console.error('Error:', error);
            errorToast(`An error occurred: ${error}`);
        });

        this.socket.on('replayData', this.handleReplayData.bind(this));
    }

    sendMove(x, y) {
        const data = {
            tile: { x, y},
        };
        this.send('move', data);
        events.emit('performAction');
    }

    sendAttack(player: Player) {
        if (!this.selectedPlayer?.canAct()) return;
        const data = {
            target: player.num,
            sameTeam: player.team.id === this.selectedPlayer.team.id,
        };
        this.send('attack', data);
        events.emit('performAction');
    }

    sendObstacleAttack(x, y) {
        if (!this.selectedPlayer?.canAct()) return;
        const data = {
            x,
            y,
        };
        this.send('obstacleattack', data);
    }

    sendSpell(x: number, y: number, player: Player | null) {
        if (!this.selectedPlayer || !this.selectedPlayer.canAct()) return;
        const data = {
            x,
            y,
            index: this.selectedPlayer.pendingSpell,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('spell', data);
        this.toggleTargetMode(false);
        this.selectedPlayer.pendingSpell = null;
        events.emit(`playerCastSpell_${this.selectedPlayer.pendingSpell}`);
        events.emit('performAction');
    }

    sendUseItem(index: number, x: number, y: number, player: Player | null) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            x,
            y,
            index,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('useitem', data);
        this.toggleItemMode(false);
        this.selectedPlayer.pendingItem = null;
        const item = this.selectedPlayer.inventory[index];
        events.emit(`playerUseItem_${item.id}`);
        events.emit('performAction');
    }

    endTutorial() {
        if (this.socket) {
            this.socket.emit('endTutorial');
        }
    }

    send(channel, data) {
        if (this.socket) {
            this.socket.emit(channel, data);
        }
    }

    getStartXY() {
        const totalWidth = HexGridManager.HEX_WIDTH * GRID_WIDTH;
        const totalHeight = HexGridManager.HEX_HEIGHT * GRID_HEIGHT;
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;
        const verticalOffset = 200;
        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + verticalOffset;
        return {startX, startY};
    }

    setUpArena() {
        const {startX, startY} = this.getStartXY();

        this.gridCorners = {
            startX,
            startY,
        };

        this.input.keyboard.on('keydown', this.handleKeyDown, this);
    }

    toggleTargetMode(flag: boolean) {
        if (flag) {
            const spell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
            
            if (spell.target == Target.AOE) {
                this.isInTargetMode = true;
                this.targetModeSize = spell?.size - 1|| 0;
                
                // Add pointer move listener to highlight tiles in radius as cursor moves
                if (!this.targetModeListener) {
                    this.targetModeListener = this.input.on('pointermove', (pointer) => {
                        if (this.isInTargetMode) {
                            this.updateTargetHighlight(pointer);
                        }
                    });
                }
                
                // Clear any existing highlights
                this.hexGridManager.clearHighlight();
                
                // Highlight target range
                if (this.selectedPlayer) {
                    this.hexGridManager.highlightTargetRange(
                        this.selectedPlayer.gridX,
                        this.selectedPlayer.gridY,
                        this.selectedPlayer.distance
                    );
                }
            }
            events.emit('pendingSpell');
            // this.brightenScene();
            // this.darkenScene(spell?.targetHighlight);
        } else {
            // Exit target mode
            this.isInTargetMode = false;
            this.targetModeSize = 1;
            
            // Clear all highlighted tiles
            this.hexGridManager.clearHighlight();
            
            // Remove the pointer move listener
            if (this.targetModeListener) {
                this.input.off('pointermove', this.targetModeListener);
                this.targetModeListener = null;
            }
            
            events.emit('clearPendingSpell');
            this.brightenScene();
        }
    }

    toggleItemMode(flag: boolean) {
        if (flag) {
            const item = this.selectedPlayer?.inventory[this.selectedPlayer?.pendingItem];
            this.hexGridManager.clearHighlight();
            
            // Highlight target range if there's a selected player
            if (this.selectedPlayer) {
                this.hexGridManager.highlightTargetRange(
                    this.selectedPlayer.gridX,
                    this.selectedPlayer.gridY,
                    this.selectedPlayer.distance
                );
            }
            
            events.emit('pendingItem');
            // this.darkenScene(item?.targetHighlight);
        } else {
            events.emit('clearPendingItem');
            // this.brightenScene();
        }
    }

    handleKeyDown(event) {
        // Check if the pressed key is a number
        const isNumberKey = (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NINE) || (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NUMPAD_NINE);
        if (!isNumberKey) {
            const isLetterKey = (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.A && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.Z);
            if (isLetterKey) {
                // Get the letter corresponding to the keyCode
                const letter = String.fromCharCode(event.keyCode);
                this.selectedPlayer?.onLetterKey(letter);
                // this.sound.play('click');
            }
        }
    }

    isFree(gridX, gridY) {
        return !this.gridMap.get(serializeCoords(gridX, gridY)) && !this.obstaclesMap.get(serializeCoords(gridX, gridY));
    }

    hasPlayer(gridX, gridY) {
        return this.gridMap.has(serializeCoords(gridX, gridY));
    }

    handleTileClick(gridX, gridY) {
        if (this.inputLocked) {
            this.unlockInput();
            return;
        }
        
        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        const pendingSpell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
        const pendingItem = this.selectedPlayer?.inventory[this.selectedPlayer?.pendingItem];
        if (pendingSpell != null) {
            if (!this.validateTarget(gridX, gridY, pendingSpell)) {
                this.playSound('nope', 0.2);
                return;
            }
            this.sendSpell(gridX, gridY, player);
        } else if (this.selectedPlayer?.pendingItem != null) {
            if (!this.validateTarget(gridX, gridY, pendingItem)) {
                this.playSound('nope', 0.2);
                return;
            }
            this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
        } else if ((!player || !player.isAlive()) && this.hexGridManager.hasObstacle(gridX, gridY)) {
            this.sendObstacleAttack(gridX, gridY);
        } else if (this.selectedPlayer && !player && this.selectedPlayer.canMoveTo(gridX, gridY)) {
            this.handleMove(gridX, gridY);
        } else if (player){ 
            player.onClick();
        }
    }

    handleTileHover(gridX, gridY, hover = true) {
        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        if (player) {
            if (hover) {
                player.onPointerOver();
            } else {
                player.onPointerOut();
            }
        }
    }

    validateTarget(gridX, gridY, action: BaseSpell | BaseItem) {
        if (action.target == Target.AOE && action.size > 1) {
            return true;
        }
        const character = this.gridMap.get(serializeCoords(gridX, gridY));
        if (!character && action.target === Target.SINGLE) return false;
        const isAlly = character?.team.id === this.playerTeamId;
        if (action.targetHighlight === TargetHighlight.ALLY && isAlly) {
            return true;
        } else if ((action.targetHighlight == undefined || action.targetHighlight === TargetHighlight.ENEMY) && !isAlly) {
            return true;
        } else if (action.targetHighlight === TargetHighlight.DEAD && !character?.isAlive()) {
            return true;
        }
        return false;
    }

    handleMove(gridX, gridY) {
        if (!this.selectedPlayer.canMoveTo(gridX, gridY) || !this.hexGridManager.isValidCell(this.selectedPlayer.gridX, this.selectedPlayer.gridY, gridX, gridY, this.isFree.bind(this))) {
            this.playSound('nope');
            return;
        }
        this.playSound('click');
        this.sendMove(gridX, gridY);
        this.hexGridManager.clearHighlight();
    }

    refreshBox() {
        if (this.selectedPlayer) {
            events.emit('showPlayerBox', this.selectedPlayer.getProps());
        }
    }
    
    refreshOverview() {
        this.overviewReady = true;
        const { team1, team2, general, initialized, queue, turnee } = this.getOverview();
        if (this.overviewReady) {
            events.emit('refreshOverview', team1, team2, general, initialized, queue, turnee);
        }
    }

    relayEvent(event, data?) {
        // console.log(`[Arena:relayEvent] Emitting event: ${event}`);
        events.emit(event, data);
    }

    refreshUI(num) {
        if (this.selectedPlayer && num === this.selectedPlayer.num) {
            this.refreshBox();
        }
        this.refreshOverview();
    }

    selectTurnee() {
        this.deselectPlayer();
        if (this.turnee) {
            const player = this.getPlayer(this.turnee.team, this.turnee.num);
            this.selectPlayer(player);
        }
    }

    selectPlayer(player: Player) {
        if (!this.gameInitialized) return;
        this.selectedPlayer = player;
        this.selectedPlayer?.select();
        this.refreshBox();
        this.refreshOverview();
    }

    deselectPlayer() {
        if (this.selectedPlayer) {
            this.selectedPlayer.deselect();
            this.selectedPlayer.cancelSkill();
            this.selectedPlayer = null;
            this.hexGridManager.clearHighlight();
        }
    }

    getPlayer(team: number, num: number): Player {
        return this.teamsMap?.get(team)?.getMember(num);
    }

    getOtherTeam(id: number): number {
        return id === 1 ? 2 : 1;
    }

    processMove({team, tile, num}) {
        if (this.gameEnded) return;
        
        const player = this.getPlayer(team, num);
        if (!player) {
            return;
        }

        this.gridMap.delete(serializeCoords(player.gridX, player.gridY));
        this.gridMap.set(serializeCoords(tile.x, tile.y), player);

        player.walkTo(tile.x, tile.y);
        this.playSoundMultipleTimes('steps', 2);
        if (player.isPlayer) {
            events.emit('playerMoved');
        }
    }

    processAttack({team, target, num, damage, hp, isKill, sameTeam}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        const otherTeam = sameTeam ? team : this.getOtherTeam(team);
        const targetPlayer = this.getPlayer(otherTeam, target);

        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(targetPlayer.gridX, targetPlayer.gridY);
        if (isKill) this.killCam(pixelX, pixelY);
        
        this.playSound('slash');
        player.attack(targetPlayer.gridX);
        targetPlayer.setHP(hp);
        targetPlayer.displaySlash(player);   
        this.displayAttackImpact(targetPlayer.gridX, targetPlayer.gridY);   
        if (player.isPlayer) {
            events.emit('playerAttacked');
        }
    }

    processObstacleAttack({team, num, x, y}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        this.playSound('slash');
        this.playSound('shatter');
        player.attack(x);
        this.displayAttackImpact(x, y);
    }

    processInventory({num, inventory}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(this.playerTeamId, num);
        player.setInventory(inventory);
        this.refreshBox();
    }

    processHPChange({team, num, hp, damage}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        if (!player) return;
        player.setHP(hp);
        if (damage) player.displayDamage(damage);
        if (player.isPlayer) events.emit('hpChange', {num, hp});
    }

    processStatusChange({team, num, statuses}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player?.setStatuses(statuses);
    }

    processMPChange({num, mp}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(this.playerTeamId, num);
        player.setMP(mp);
    }

    processUseItem({team, num, animation, name, sfx}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player.useItemAnimation(animation, name);
        this.playSound(sfx);
        if (player.isPlayer) {
            events.emit(`playerUseItem`);
        }
    }

    processCast(flag, {team, num, id, location,}) {
        if (this.gameEnded) return;
        // console.log(`Processing cast: ${flag} ${team} ${num} ${id} ${location}`);
        const player = this.getPlayer(team, num);
        const spell = getSpellById(id);
        player?.castAnimation(flag, spell?.name);
        // const { x: pixelX, y: pixelY } = this.hexGridToPixelCoords(player.gridX, player.gridY);
        // this.spellCam(pixelX, pixelY, false);
        if (player.isPlayer) {
            events.emit(`playerCastSpell`);
        }
    }

    processTerrain(updates: TerrainUpdate[]) {
        if (this.gameEnded) return;
        updates.forEach(({x, y, terrain}) => {
            const handlers = {
                [Terrain.FIRE]: () => this.handleFireTerrain(x, y),
                [Terrain.ICE]: () => this.handleIceTerrain(x, y),
                [Terrain.NONE]: () => this.handleClearTerrain(x, y)
            };
            handlers[terrain]?.();
        });
    }

    hasFlame(x: number, y: number) {
        return this.terrainMap.get(serializeCoords(x, y)) === Terrain.FIRE;
    }

    hasIce(x: number, y: number) {
        return this.terrainMap.get(serializeCoords(x, y)) === Terrain.ICE;
    }

    createIceBlock(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        const depth = this.yToZ(y) + DEPTH_OFFSET;
        const icesprite = this.add.sprite(pixelX, pixelY, 'iceblock')
            .setDepth(depth).setAlpha(0.9).setOrigin(0.5, 0.35).setInteractive();
        // Add pointerover event to sprite
        icesprite.on('pointerover', () => {
            if (this.selectedPlayer?.isNextTo(x, y) 
                && this.selectedPlayer.canAct()
                && this.selectedPlayer.pendingSpell == null
                && this.selectedPlayer.pendingItem == null) {
                events.emit('hoverEnemyCharacter');
            } 
        });
        // Add pointerout event to sprite
        icesprite.on('pointerout', () => {
            events.emit('unhoverCharacter');
        });
        icesprite.postFX.addShine(0.5, .2, 5);
        return icesprite;
    }

    flickerAndDestroy(sprite, times, duration) {
        if (!sprite) return;
    
        // Create a tween to flicker the sprite
        this.tweens.add({
            targets: sprite,
            alpha: { from: 1, to: 0 },
            duration: duration / (times * 2),
            yoyo: true,
            repeat: times - 1, // Repeat for the number of times - 1 since it starts from 1
            onComplete: () => {
                sprite.destroy();
            }
        });
    }    

    displayAttackImpact(gridX, gridY) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(gridX, gridY);
        this.localAnimationSprite.setPosition(pixelX, pixelY + 30)
            .setVisible(true)
            .setDepth(this.yToZ(gridY) + DEPTH_OFFSET)
            .setScale(0.5)
            .play('impact');
    }

    yToZ(y) {
        return Number((3.5 + y/10).toFixed(2));
    }

    processLocalAnimation({x, y, id, isKill}) {
        const spell = getSpellById(id);
        if (spell.size % 2 === 0) {
            x += 0.5;
            y += 0.5;
        }
        const {x: pixelX, y: pixelYInitial} = this.hexGridToPixelCoords(x, y);
        let pixelY = pixelYInitial;
        if (spell.yoffset) pixelY += spell.yoffset;

        if (isKill) {
            this.killCam(pixelX, pixelY);
        } else {
            // this.spellCam(pixelX, pixelY);
        }
        const scale = spell.scale > 1 ? spell.scale : LOCAL_ANIMATION_SCALE;
        console.log(`Playing ${spell.vfx}`)
        this.localAnimationSprite.setPosition(pixelX, pixelY)
            .setVisible(true)
            .setDepth(this.yToZ(y) + DEPTH_OFFSET)
            .setScale(scale)
            .play(spell.vfx);
        this.playSound(spell.sfx);

        if (spell.shake) {
            const duration = isKill ? 2000 : 250;
            const intensity = 0.002;
            this.cameras.main.shake(duration, intensity);
        } 
    }

    // Add this new method to handle camera movement
    panCameraWithOffset(targetX: number, targetY: number, duration: number = 1000, easing: string = 'Cubic.easeOut') {
        if (FREEZE_CAMERA) return;
        // Get screen dimensions and target position
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;

        // Calculate camera movement from center
        const moveRatio = 0.4;
        const screenCenterX = screenWidth/2;
        const screenCenterY = screenHeight/2;
        
        const offsetX = (targetX - screenCenterX) * moveRatio;
        const offsetY = (targetY - screenCenterY) * moveRatio;

        // Pan camera smoothly from center
        this.cameras.main.pan(
            screenCenterX + offsetX,
            screenCenterY + offsetY,
            duration,
            easing
        );
    }

    // Update spellCam to use the new method
    spellCam(pixelX: number, pixelY: number, revert = false) {
        const originalScrollX = this.cameras.main.scrollX;
        const originalScrollY = this.cameras.main.scrollY;
        
        this.panCameraWithOffset(pixelX, pixelY);

        if (revert) {
            // After animation duration, pan back to original position
            setTimeout(() => {
                this.cameras.main.pan(
                    this.cameras.main.width/2 + originalScrollX,
                    this.cameras.main.height/2 + originalScrollY,
                    1000,
                    'Power2'
                );
            }, 1000);
        }
    }

    // Update highlightTurnee to use the new method
    highlightTurnee() {
        if (!this.turnee) return;
        
        const player = this.getPlayer(this.turnee.team, this.turnee.num);
        if (!player) return;

        // If killcam is active, wait for it to finish before highlighting turnee
        if (this.killCamActive) {
            this.time.delayedCall(KILL_CAM_DURATION * 1000, () => {
                this.highlightTurnee();
            });
            return;
        }

        const {x, y} = this.hexGridToPixelCoords(player.gridX, player.gridY);
        // this.panCameraWithOffset(x, y);
    }

    processGameEnd(data: OutcomeData) {
        this.gameEnded = true;
        this.musicManager.playEnd();
        const winningTeam = data.isWinner ? this.teamsMap.get(this.playerTeamId) : this.teamsMap.get(this.getOtherTeam(this.playerTeamId));
        setTimeout(() => {
            winningTeam?.members.forEach((player) => {
                player.victoryDance();
            });
        }, 200);
        if (this.overviewReady) {
            events.emit('gameEnd', data);
        }
    }

    processScoreUpdate({score}) {
        // console.log(`Team ${teamId} score updated to ${score}`);
        const team = this.teamsMap.get(this.playerTeamId);
        const _score = team.score;
        team.setScore(score);
        // this.refreshOverview(); // TODO: add if display score again
        // if (score - _score > 50) this.playSound('cheer', 2);
    }

    processAddCharacter(data: {team: number, character: PlayerNetworkData}) {
        const team = this.teamsMap.get(data.team);
        this.placeCharacter(data.character, team, false);
    }

    processQueueData(data: any[]) {
        this.queue = data;
        this.refreshOverview();
    }

    processTurnee(data: {num: number, team: number, turnDuration: number, timeLeft: number}) {
        if (this.gameEnded) return;
        // Determine if turnee is player
        if (data.team != this.playerTeamId) {
            events.emit('enemyTurn');
        }
        events.emit('turnStarted');

        this.turnee = data;
        this.selectTurnee();
        this.highlightTurnee();
    }

    updateMusicIntensity(ratio){
        this.musicManager.updateMusicIntensity(ratio);
    }

    createSounds() {
        this.SFX = Object.fromEntries(
            Arena.SOUND_NAMES.map(name => [
                name,
                this.sound.get(name) || this.sound.add(name)
            ])
        );

        events.on('settingsChanged', this.onSettingsChanged, this);
    }

    onSettingsChanged = (settings) => {
        this.sfxVolume = settings.sfxVolume / 100;
    }

    playSound(name, volume = 1, loop = false) {
        if (!this.SFX || !this.SFX[name]) {
            console.warn(`Sound effect "${name}" not found`);
            return;
        }
        
        const adjustedVolume = volume * this.sfxVolume;
        try {
            this.SFX[name].play({delay: 0, volume: adjustedVolume, loop});
        } catch (error) {
            console.warn(`Error playing sound "${name}":`, error);
        }
    }

    stopSound(name) {
        this.SFX[name].stop();
    }

    playSoundMultipleTimes(key, times) {
        if(times <= 0) return;
    
        const sound = this.SFX[key];
    
        sound.once('complete', () => {
            this.playSoundMultipleTimes(key, times - 1); // Play the sound again
        });
    
        sound.play();
    }


    createAnims() {
        allSprites.forEach((asset) => {
            // Character postures
            this.createCharacterAnim(asset, 'idle', [9, 10, 11], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'idle_hurt', [33, 34, 35], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'walk', [6, 7, 8], { repeat: -1 });
            this.createCharacterAnim(asset, 'attack', [12, 13, 14], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'dodge', [45, 46, 47], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'item', [48, 49, 50], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'hurt', [42, 43, 44], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'cast', [39, 40, 41], { frameRate: BASE_ANIM_FRAME_RATE });
            this.createCharacterAnim(asset, 'die', [51, 52, 53], { frameRate: BASE_ANIM_FRAME_RATE * 2 });
            this.createCharacterAnim(asset, 'victory', [15, 16, 17], { repeat: -1, yoyo: true });
            this.createCharacterAnim(asset, 'boast', [15, 16, 17], { frameRate: BASE_ANIM_FRAME_RATE * 1.5, repeat: 2, yoyo: true });
        });

        this.anims.create({
            key: `cast`, 
            frames: this.anims.generateFrameNumbers('cast', { frames: [10, 11, 12] }), 
            frameRate: 15, 
            repeat: -1
        });

        this.anims.create({
            key: `slash`, 
            frames: this.anims.generateFrameNumbers('slash', { frames: [99, 100, 101, 102] }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `impact`, 
            frames: this.anims.generateFrameNumbers('impact', { start: 0, end: 12 }), 
            frameRate: 25, 
        });

        // Spells VFX

        this.anims.create({
            key: `potion_heal`, 
            frames: this.anims.generateFrameNumbers('potion_heal'), 
            frameRate: 10, 
        });

        this.anims.create({
            key: `revive`, 
            frames: this.anims.generateFrameNumbers('revive'), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `explosion_1`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 48, end: 59 }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `explosion_2`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 12, end: 23 }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `explosion_3`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 0, end: 11 }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `thunder`, 
            frames: this.anims.generateFrameNumbers('thunder', { start: 36, end: 47 }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `thunder+`, 
            frames: this.anims.generateFrameNumbers('thunder2', { start: 15, end: 29 }), 
            frameRate: 15, 
        });

        this.anims.create({
            key: `ice`, 
            frames: this.anims.generateFrameNumbers('ice', { start: 54, end: 67 }), 
            frameRate: 15,
        });

        this.anims.create({
            key: `ice+`, 
            frames: this.anims.generateFrameNumbers('ice', { start: 36, end: 48 }), 
            frameRate: 15,
        });

        this.anims.create({
            key: `iceX`, 
            frames: this.anims.generateFrameNumbers('ice2', {frames: [128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171]}), 
            frameRate: 15,
        });

        this.anims.create({
            key: `poison`, 
            frames: this.anims.generateFrameNumbers('poison', { start: 0, end: 16 }), 
            frameRate: 15,
        });

        this.anims.create({
            key: `mute`, 
            frames: this.anims.generateFrameNumbers('mute', { start: 0, end: 13 }), 
            frameRate: 15,
        });

        // Terrain VFX

        this.anims.create({
            key: `ground_flame`, 
            frames: this.anims.generateFrameNumbers('thunder', { start: 48, end: 59 }), 
            frameRate: 15, 
            repeat: -1,
            // yoyo: true,
        });

        this.anims.create({
            key: `smoke`, 
            frames: this.anims.generateFrameNumbers('smoke', { start: 32, end: 42 }), 
            frameRate: 12,
        });

        // Status effects VFX

        this.anims.create({
            key: `paralyzed`, 
            frames: this.anims.generateFrameNumbers('statuses', { start: 56, end: 63 }), 
            frameRate: 15,
            repeat: -1,
        });

        this.anims.create({
            key: `poisoned`, 
            frames: this.anims.generateFrameNumbers('statuses', { start: 0, end: 7 }), 
            frameRate: 10,
            repeat: -1,
        });

        this.anims.create({
            key: `muted`, 
            frames: this.anims.generateFrameNumbers('statuses', { start: 16, end: 23 }), 
            frameRate: 10,
            repeat: -1,
        });


        this.animationScales = {
            slash: 1,
        }
    }

    placeCharacter(character: PlayerNetworkData, team: Team, isReconnect = false) {
        const isPlayer = team.id === this.playerTeamId;
        const {x, y} = this.hexGridToPixelCoords(character.x, character.y);

        const player = new Player(
            this, this, team, character.name, character.x, character.y, x, y,
            team.getMembers().length + 1, character.portrait, isPlayer, character.class,
            character.hp, character.maxHP, character.mp, character.maxMP,
            character.level, character.xp,
        );
        
        if (isPlayer) {
            player.setDistance(character.distance);
            player.setInventory(character.inventory);
            player.setSpells(character.spells);
        }
        player.setStatuses(character.statuses);

        if (!isReconnect) {
            player.y -= 1000;
            // Stagger the entrance of each player with a random offset between -200 and +200 ms
            const randomOffset = Math.floor(Math.random() * 401) - 200; // Random number between -200 and 200
            const entranceDelay = 750 + randomOffset;
            this.time.delayedCall(entranceDelay, player.makeAirEntrance, [], player);
        }

        this.gridMap.set(serializeCoords(character.x, character.y), player);

        team.addMember(player);
    }

    placeCharacters(data: PlayerNetworkData[], team: Team, isReconnect = false) {
        data.forEach(player => this.placeCharacter(player, team, isReconnect));
    }

    highlightCells(gridX, gridY, radius) {
        // Clear any existing highlights
        this.hexGridManager.clearHighlight();
        
        // Use the common helper with custom validation for movement
        this.hexGridManager.highlightTilesInRadius(
            gridX, 
            gridY, 
            radius, 
            0x00ffff, // Cyan
            (targetX, targetY) => this.hexGridManager.isValidCell(gridX, gridY, targetX, targetY, this.isFree.bind(this))
        );
    }

    hasEnemyNextTo(gridX, gridY) {
        const enemyTeam = this.teamsMap.get(this.getOtherTeam(this.playerTeamId))
        return enemyTeam.getMembers().some(member => {
            return hexDistance(member.gridX, member.gridY, gridX, gridY) <= 1;
        });
    }
    
    create()
    {
        // Add the background image first so it's behind everything else
        const bg = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'arenaBg')
            .setDepth(0)
            .setOrigin(0.5, 0.5);
        
        // Apply a basic scale to cover the screen initially
        const baseScaleX = this.cameras.main.width / bg.width;
        const baseScaleY = this.cameras.main.height / bg.height;
        const baseScale = Math.max(baseScaleX, baseScaleY);
        bg.setScale(baseScale);
        
        // Handle window resizing
        this.scale.on('resize', (gameSize) => {
            const newScaleX = gameSize.width / bg.width;
            const newScaleY = gameSize.height / bg.height;
            const newScale = Math.max(newScaleX, newScaleY);
            
            bg.setScale(newScale);
            bg.setPosition(gameSize.width / 2, gameSize.height / 2);
        });
        
        // Follow camera movement - keep background centered on screen
        this.cameras.main.on('camerascroll', () => {
            if (!bg) return;
            
            // Keep background centered on the camera's view
            const centerX = this.cameras.main.scrollX + this.cameras.main.width / 2;
            const centerY = this.cameras.main.scrollY + this.cameras.main.height / 2;
            
            bg.setPosition(centerX, centerY);
        });
        
        this.loadBackgroundMusic();
        this.setUpArena();
        this.createAnims();
        this.createSounds();

        this.localAnimationSprite = this.add.sprite(0, 0, '').setScale(LOCAL_ANIMATION_SCALE).setOrigin(0.5, 0.7).setVisible(false);
        this.localAnimationSprite.on('animationcomplete', () => this.localAnimationSprite.setVisible(false), this);

        this.input.mouse.disableContextMenu();

        this.musicManager = new MusicManager(this, 1, 12, [5, 6, 11]);
        this.musicManager.playBeginning();
        this.playSound('crowd', 0.5, true);

        this.environmentalAudioSources = {
            flames: 0,
        }

        this.gameSettings = {
            tutorial: false,
            spectator: false,
            game0: false,
            mode: null,
        }

        this.hexGridManager = new HexGridManager(this);

        this.sceneCreated = true;
        this.emptyQueue();
        
        this.setUpArena();
        
        this.input.keyboard.on('keydown-D', () => {
            this.hexGridManager.toggleCoordinateDisplay();
        });

        // Add character glow effect listener
        window.addEventListener('characterInSpellRadius', (e: CustomEvent) => {
            const { x, y, isAlly } = e.detail;
            const player = this.gridMap.get(serializeCoords(x, y));
            if (player) {
                player.sprite.setTint(isAlly ? 0x00ff00 : 0xff0000);
                player.sprite.postFX.addGlow(isAlly ? 0x00ff00 : 0xff0000, 4, 0, false, 0.5);
                
                // Reset glow after a short delay
                this.time.delayedCall(100, () => {
                    if (player.sprite) {
                        player.sprite.clearTint();
                        player.sprite.postFX.clear();
                    }
                });
            }
        });
    }

    emptyQueue(){ // Process the events that have been queued during initialization
        // console.log(`[Arena:emptyQueue] Emptying event queue`);
        if (this.eventsQueue.length > 1) this.isLateToTheParty = true;
        this.eventsQueue.forEach((event) => {
            this.socket.onevent.call(this.socket, event);
        });
    };

    loadBackgroundMusic() {
        // Add the music files to the loader
        for (let i = 2; i <= 12; i++) {
            this.load.audio(`bgm_loop_${i}`, require(`@assets/music/bgm_loop_${i}.wav`));
        }
        this.load.audio('bgm_end', bgmEndSFX);
    
        // Start the loader
        this.load.start();
    }

    initializeGame(data: GameData): void {
        recordLoadingStep('finish');
        const isReconnect = data.general.reconnect || this.isLateToTheParty;
        // console.log(`[Arena:initializeGame] Reconnecting to game: ${isReconnect}`);

        this.playerTeamId = data.player.teamId;

        if(this.playerTeamId === undefined) {
            console.error('Player team id is undefined');
        }

        this.gameSettings.spectator = data.general.spectator;
        this.gameSettings.mode = data.general.mode;
        this.queue = data.queue;
        this.turnee = data.turnee;
        this.gameSettings.game0 = data.player.player.completedGames === 0;

        this.tutorialManager = new TutorialManager(this, data.player.player.engagementStats);

        this.teamsMap.set(data.player.teamId, new Team(this, data.player.teamId, true, data.player.player, data.player.score));
        this.teamsMap.set(data.opponent.teamId, new Team(this, data.opponent.teamId, false, data.opponent.player));

        // Events from the HUD
        events.on('itemClick', (keyIndex) => {
            this.selectedPlayer?.onKey(keyIndex);
        });

        events.on('passTurn', () => {
            this.playSound('click');
            this.socket.emit('passTurn');
        });

        events.on('abandonGame', () => {
            this.abandonGame();
        });

        events.on('exitGame', () => {
            this.destroy();
        });   
        
        events.on('teamRevealed', () => {
            this.socket.emit('teamRevealed');
            this.displayGame(data, isReconnect);
        });

        events.emit('gameInitialized', {game0: this.gameSettings.game0});
        
        if (this.gameSettings.game0) {
            events.emit('revealTeam', data.player.team);
        } else {
            this.displayGame(data, isReconnect);
        }
    }

    displayGame(data: GameData, isReconnect: boolean) {
        this.placeCharacters(data.player.team, this.teamsMap.get(data.player.teamId), isReconnect);
        this.placeCharacters(data.opponent.team, this.teamsMap.get(data.opponent.teamId), isReconnect);
        
        const tilesDelay = isReconnect ? 0 : 1000;

        this.hexGridManager.floatHexTiles(
            tilesDelay,
            this.handleTileClick.bind(this),
            this.handleTileHover.bind(this)
        );
        
        // Move this line AFTER floatHexTiles so the tiles exist
        this.hexGridManager.setCharacterTiles(this.gridMap);

        this.processTerrain(data.terrain); // Put after floatTiles() to allow for tilesMap to be intialized

        if (isReconnect) {
            this.setGameInitialized();
            this.selectTurnee();
        } else {
            const delay = 3000;
            setTimeout(this.refreshOverview.bind(this), delay + 1000);
            setTimeout(() => {
                this.displayGEN(GEN.COMBAT_BEGINS);
                this.setGameInitialized();
                this.selectTurnee();
            }, delay);
        }
    }

    setGameInitialized() {
        this.gameInitialized = true;
        this.refreshOverview();
    }

    startAnimation() {
        const bandHeight = 300; 
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const bandY = (screenHeight - bandHeight) / 2; // Position Y so the band is centered vertically
    
        // Create the semi-transparent black band
        let currentHeight = 1; // Start with a height of 1
        const band = this.add.graphics({ fillStyle: { color: 0x000000, alpha: 0.5 } }).setDepth(10);
        band.fillRect(0, bandY, screenWidth, currentHeight);
    
        // Animate the height of the band
        this.tweens.add({
            targets: { height: 1 },
            height: bandHeight, // Target height for the animation
            duration: 500,
            ease: 'Power2',
            onUpdate: (tween) => {
                currentHeight = tween.getValue();
                band.clear(); // Clear previous frame
                band.fillRect(0, bandY, screenWidth, currentHeight);
            },
            onComplete: () => {
                // Once band animation is complete, animate 'START' text
                const startText = this.add.text(0, bandY + (bandHeight - 20) / 2, 'FIGHT!', { fontSize: '40px', color: '#FFFFFF', fontFamily: 'Kim' }).setAlpha(0).setDepth(11);
                startText.x = -startText.width; // Position text off-screen to the left
    
                // Slide in animation for 'START' text
                this.tweens.add({
                    targets: startText,
                    x: (screenWidth - startText.width) / 2,
                    alpha: 1,
                    duration: 500,
                    ease: 'Power2',
                    hold: 500, // Keep in place for a bit
                    onComplete: () => {
                        // Slide out to the right
                        this.tweens.add({
                            targets: startText,
                            x: screenWidth,
                            alpha: 0,
                            duration: 200,
                            ease: 'Power2',
                            onComplete: () => {
                                // Cleanup: remove the text and band
                                startText.destroy();
                                band.destroy();
                            }
                        });
                    }
                });
            }
        });
    }

    enqueueGEN(gen: GEN) {
        this.genQueue.push(gen);
        this.processGENQueue();
    }

    processGENQueue() {
        if (this.gameEnded || this.isDisplayingGEN || this.killCamActive || this.genQueue.length === 0) {
            return;
        }
        this.isDisplayingGEN = true;
        const gen = this.genQueue.shift();
        this.displayGEN(gen).then(() => {
            this.isDisplayingGEN = false;
            this.processGENQueue(); // Proceed to next GEN
        });
    }

    displayGEN(gen: GEN): Promise<void> {
        if (this.gameEnded) return Promise.resolve();
        
        return new Promise((resolve) => {
            if (this.killCamActive) {
                this.genQueue.unshift(gen);
                resolve();
                return;
            }

            if (gen != GEN.COMBAT_BEGINS && this.gameSettings.game0) {
                return;
            }

            const config = Arena.GEN_CONFIGS[gen];
            if (!config) {
                resolve();
                return;
            }

            // Setup GEN Background
            const textTweenDuration = 600;
            const textDelay = 400;
            const yOffset = 80;
            const bgYPosition = yOffset;
            // Remove camera scroll from xPosition since we're using setScrollFactor(0)
            const xPosition = this.cameras.main.centerX;
            const yPosition = yOffset;
            const scale = 0.5;

            let genBg = this.add.image(xPosition, bgYPosition, 'gen_bg')
                .setScrollFactor(0)
                .setAlpha(0)
                .setDepth(10)
                .setScale(scale);

            this.tweens.add({
                targets: genBg,
                alpha: 0.7,
                duration: 200,
                ease: 'Power2',
            });

            // Setup GEN Texts
            const targets = [
                this.add.image(-350, yPosition, config.text1)
                    .setScrollFactor(0) // Make it stick to camera
                    .setDepth(10)
                    .setScale(scale),
                this.add.image(this.cameras.main.width + 100, yPosition, 'blue_bang')
                    .setScrollFactor(0) // Make it stick to camera
                    .setDepth(10)
                    .setScale(scale)
            ];
            
            if (config.text2) {
                targets.push(
                    this.add.image(this.cameras.main.width + 100, yPosition, config.text2)
                        .setScrollFactor(0) // Make it stick to camera
                        .setDepth(10)
                        .setScale(scale)
                );
            }

            // Animate GEN Texts into View
            this.tweens.add({
                targets,
                x: xPosition,
                duration: textTweenDuration,
                ease: 'Power2',
                delay: textDelay,
                onComplete: () => {
                    // After displaying, wait for a duration then fade out
                    this.time.delayedCall(2000, () => {
                        this.tweens.add({
                            targets: targets.concat([genBg]),
                            alpha: 0,
                            duration: 200,
                            ease: 'Power2',
                            onComplete: () => {
                                // Clean up GEN elements
                                targets.forEach(t => t.destroy());
                                genBg.destroy();
                                resolve(); // Resolve the promise to allow next GEN to be processed
                            }
                        });
                    });
                }
            });
        });
    }

    getOverview() {
        const overview =  {
            team1: this.teamsMap.get(1).getOverview(),
            team2: this.teamsMap.get(2).getOverview(),
            general: this.gameSettings,
            initialized: this.gameInitialized,
            queue: this.getQueue(),
            turnee: this.getTurnee(),
        };
        return overview;
    }

    getQueue() {
        return this.queue;
    }

    getTurnee() {
        return this.turnee;
    }

    killCam(x, y) {
        this.killCamActive = true;
        // Save the original camera state
        const originalZoom = this.cameras.main.zoom;
        const originalTimeScale = this.localAnimationSprite.anims.timeScale;
        const originalSoundRate = this.sound.rate;
        const originalTweenRate = this.tweens.timeScale;
        const originalScrollX = this.cameras.main.scrollX;
        const originalScrollY = this.cameras.main.scrollY;

        const targetZoom = 2; 
        const slowMotionScale = 0.2; 

        this.sound.setRate(slowMotionScale);
        this.localAnimationSprite.anims.timeScale = slowMotionScale;
        this.tweens.timeScale = slowMotionScale;
        
        // For every sprites in this.sprites, set anims.timeScale to slowMotionScale
        this.sprites.forEach((sprite) => {
            if (sprite.anims) sprite.anims.timeScale = slowMotionScale;
        });

        const firstDelay = 0;
        const secondDelay = firstDelay + KILL_CAM_DURATION * 1000;
        const cameraSpeed = 200;

        this.time.delayedCall(firstDelay, () => {
            // Move camera to the spell's location and zoom in
            this.cameras.main.pan(x, y, cameraSpeed, 'Power2');
            this.cameras.main.zoomTo(targetZoom, cameraSpeed, 'Power2');
        });
          
        this.time.delayedCall(secondDelay, () => {
            // Return the camera to its original position and zoom level
            const returnX = this.cameras.main.width / 2 + originalScrollX;
            const returnY = this.cameras.main.height / 2 + originalScrollY;
            this.cameras.main.pan(returnX, returnY, cameraSpeed, 'Power2');
            this.cameras.main.zoomTo(originalZoom, cameraSpeed, 'Power2');
            this.localAnimationSprite.anims.timeScale = originalTimeScale;
            this.sound.setRate(originalSoundRate);
            this.tweens.timeScale = originalTweenRate;

            this.sprites.forEach((sprite) => {
                if (sprite.anims) sprite.anims.timeScale = originalTimeScale;
            });
            this.killCamActive = false;
            this.processGENQueue(); // Trigger processing of GEN queue after kill cam
        });
    }

    addFlames() {
        this.environmentalAudioSources.flames++;
        this.updateEnvironmentAudio();
    }

    removeFlames() {
        this.environmentalAudioSources.flames--;
        this.updateEnvironmentAudio();
    }

    updateEnvironmentAudio() {
        if (this.gameEnded) return;
        const flames = this.environmentalAudioSources.flames;
        if (flames > 0) {
            this.playSound('flames', 0.5, true);
        } else {
            this.stopSound('flames');
        }
    }
    
    abandonGame() {
        this.socket.emit('abandonGame');
        this.destroy();
    }

    destroy() {
        events.emit('notifyMatchmakerLeave');
        this.socket.disconnect();

        this.teamsMap.forEach((team) => {
            team.members.forEach((player) => {
                player.destroy();
            });
        });

        if (this.SFX) {
            Object.values(this.SFX).forEach(sound => {
                // @ts-ignore
            if (sound.isPlaying) {
                // @ts-ignore
                sound.stop();
                }
            });
        }
    
        // Stop and destroy the music manager
        if (this.musicManager) {
            this.musicManager.destroy();
        }
    
        // Stop any ongoing tweens
        this.tweens.killAll();
    
        // Stop any ongoing timers
        this.time.removeAllEvents();
    
        // Stop the HUD and current scene
        this.scene.stop('HUD');

        // In the destroy method, add:
        if (this.tutorialManager) {
            this.tutorialManager.destroy();
        }
        this.scene.stop();

        // Clean up any other resources or listeners
        events.removeAllListeners();
        events.off('settingsChanged', this.onSettingsChanged, this);

        // Add cleanup for hexGridManager
        if (this.hexGridManager) {
            this.hexGridManager.destroy();
        }
    }

    // update (time, delta)
    // {
    // }

    showFloatingHand(x: number, y: number, orientation: 'up' | 'down' | 'left' | 'right' = 'up') {
        // console.log(`[showFloatingHand] @ x: ${x}, y: ${y}`);
        const scale = 0.3;

        if (!this.handSprite) {
            this.handSprite = this.add.sprite(x, y, 'hand').setDepth(1000).setScale(scale);
            // Add white glow effect
            this.handSprite.preFX.addGlow(0xffffff, 4, 0, false, 0.1, 16);
        } else {
            // Stop existing tweens
            this.tweens.killTweensOf(this.handSprite);
            
            // Move the hand to the new position
            this.handSprite.setPosition(x, y);
        }

        // Add a floating animation
        this.tweens.add({
            targets: this.handSprite,
            y: y - 10,
            duration: 300,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Set the appropriate angle based on orientation
        switch (orientation) {
            case 'down':
                this.handSprite.setAngle(180);
                break;
            case 'left':
                this.handSprite.setAngle(-90);
                break;
            case 'right':
                this.handSprite.setAngle(90);
                break;
            default: // 'up'
                this.handSprite.setAngle(0);
        }

        return this.handSprite;
    }

    hideFloatingHand() {
        if (this.handSprite) {
            this.tweens.killTweensOf(this.handSprite);
            this.handSprite.destroy();
            this.handSprite = null;
        }
    }

    getCharacterPosition(playerTeam: boolean, characterIdx: number) {
        const teamId = playerTeam ? this.playerTeamId : 2;
        const character = this.teamsMap.get(teamId).members[characterIdx];
        return {x: character.gridX, y: character.gridY};
    }

    pointToCharacter(playerTeam: boolean, characterIdx: number) {
        const {x: gridX, y: gridY} = this.getCharacterPosition(playerTeam, characterIdx);
        const {x, y} = this.hexGridToPixelCoords(gridX, gridY);
        // const yOffset = this.tutorialSettings.showHealthBars ? 100 : 60;
        const yOffset = 60;
        this.showFloatingHand(x - 5, y - yOffset, 'down');
    }

    pointToTile(tileX: number, tileY: number) {
        const {x, y} = this.hexGridToPixelCoords(tileX, tileY);
        this.showFloatingHand(x - 5, y, 'down');
    }

    summonEnemy(x: number, y: number, attackMode: AIAttackMode = AIAttackMode.IDLE) {
        this.send('tutorialEvent', {action: 'summonEnemy', x, y, attackMode});
    }

    summonAlly(x: number, y: number, className: Class) {
        this.send('tutorialEvent', {action: 'summonAlly', x, y, className});
    }

    putInFormation() {
        this.send('tutorialEvent', {action: 'putInFormation'});
    }

    slowDownCooldowns() {
        this.send('tutorialEvent', {action: 'slowDownCooldowns'});
    }

    isCharacterSelected(index: number) {
        return this.selectedPlayer?.num === index;
    }

    isTutorial() {
        return this.gameSettings.tutorial;
    }

    handleReplayData(data: any) {
        this.isReplay = true;
        this.replayData = data;
        
        // Initialize game with first gameStatus message
        const initialStatus = this.replayData.messages.find(m => m.event === 'gameStatus');
        if (initialStatus) {
            this.initializeGame(initialStatus.data);
        }

        // Start replay timer
        this.startReplayPlayback();
    }

    startReplayPlayback() {
        this.currentReplayIndex = 0;
        this.processNextReplayEvent();
    }

    processNextReplayEvent() {
        if (this.currentReplayIndex >= this.replayData.messages.length) {
            console.log('Replay finished');
            return;
        }

        const currentMessage = this.replayData.messages[this.currentReplayIndex];
        const nextMessage = this.replayData.messages[this.currentReplayIndex + 1];

        // Process current message
        if (currentMessage.event !== 'gameStatus') { // We already processed gameStatus
            this.processReplayMessage(currentMessage);
        }

        this.currentReplayIndex++;

        // Schedule next message if there is one
        if (nextMessage) {
            const delay = nextMessage.timestamp - currentMessage.timestamp;
            this.time.delayedCall(delay, this.processNextReplayEvent, [], this);
        }
    }

    processReplayMessage(message: any) {
        const handler = this.eventHandlers.get(message.event);
        if (handler) {
            handler(message.data);
        } else {
            console.warn(`No handler found for replay event: ${message.event}`);
        }
    }

    darkenScene(targetHighlight: TargetHighlight = TargetHighlight.ENEMY) {
        if (this.isDarkened) return;
        this.isDarkened = true;

        this.getAllDarkenableObjects().forEach(obj => obj.setTint(TINT_COLOR));
        this.hexGridManager.darkenAllTiles(TINT_COLOR);

        // Process players separately for health bars
        this.teamsMap.forEach(team => {
            team.members.forEach(player => {
                if (this.shouldStayBright(player, targetHighlight)) {
                    player.sprite.clearTint();
                    player.healthBar?.brighten();
                    player.MPBar?.brighten();
                } else {
                    player.healthBar?.darken();
                    player.MPBar?.darken();
                }
            });
        });
    }

    brightenScene() {
        if (!this.isDarkened) return;
        this.isDarkened = false;

        this.getAllDarkenableObjects().forEach(obj => obj.clearTint());
        this.hexGridManager.brightenAllTiles();

        // Brighten all bars
        this.teamsMap.forEach(team => {
            team.members.forEach(player => {
                player.healthBar?.brighten();
                player.MPBar?.brighten();
            });
        });

        // Restore movement range highlight if appropriate
        if (this.selectedPlayer?.canAct() && 
            !this.selectedPlayer?.pendingSpell && 
            !this.selectedPlayer?.pendingItem) {
            this.selectedPlayer.displayMovementRange();
        }
    }

    private shouldStayBright(player: Player, targetHighlight: TargetHighlight = TargetHighlight.ENEMY): boolean {
        const isAlly = this.isAlly(player);
        
        switch (targetHighlight) {
            case TargetHighlight.ALLY:
                return isAlly && player.isAlive();
            case TargetHighlight.ENEMY:
                return !isAlly && player.isAlive();
            case TargetHighlight.DEAD:
                return !player.isAlive();
            default:
                return !isAlly && player.isAlive();
        }
    }

    // Add these new methods:
    private handleFireTerrain(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.hexGridToPixelCoords(x, y);
        const sprite = this.add.sprite(pixelX, pixelY, '')
            .setDepth(this.yToZ(y)).setScale(2).setAlpha(0.9);
        this.addFlames();
        sprite.on('destroy', () => {
            this.removeFlames();
        });
        sprite.anims.play('ground_flame');
        this.sprites.push(sprite);
        this.terrainSpritesMap.set(serializeCoords(x, y), sprite);
        this.terrainMap.set(serializeCoords(x, y), Terrain.FIRE);
        events.emit('flamesAppeared');
    }

    private handleIceTerrain(x: number, y: number) {
        const icesprite = this.createIceBlock(x, y);
        this.terrainSpritesMap.set(serializeCoords(x, y), icesprite);
        this.terrainMap.set(serializeCoords(x, y), Terrain.ICE);
        const tile = this.hexGridManager.getTile(x, y);
        // @ts-ignore
        if (tile.tween) tile.tween.stop();
        this.obstaclesMap.set(serializeCoords(x, y), true);
        events.emit('iceAppeared');
    }

    private handleClearTerrain(x: number, y: number) {
        this.obstaclesMap.delete(serializeCoords(x, y));
        this.terrainMap.delete(serializeCoords(x, y));
        const terrainsprite = this.terrainSpritesMap.get(serializeCoords(x, y));
        if (terrainsprite) {
            this.flickerAndDestroy(terrainsprite, 5, 1000);
            this.terrainSpritesMap.delete(serializeCoords(x, y));
        }
    }

    private createCharacterAnim(asset: string, key: string, frames: number[], config = {}) {
        this.anims.create({
            key: `${asset}_anim_${key}`,
            frames: this.anims.generateFrameNumbers(asset, { frames }),
            frameRate: BASE_ANIM_FRAME_RATE,
            ...config
        });
    }

    private getAllDarkenableObjects() {
        return [
            ...this.sprites,
            ...Array.from(this.teamsMap.values()).flatMap(team => 
                team.members.map(player => player.sprite)
            )
        ];
    }

    // Add helper methods:
    isPlayerTeam(teamId: number): boolean {
        return teamId === this.playerTeamId;
    }

    isAlly(player: Player): boolean {
        return this.isPlayerTeam(player.team.id);
    }

    hexGridToPixelCoords(gridX, gridY) {
        return this.hexGridManager.hexGridToPixelCoords(gridX, gridY);
    }

    updateTargetHighlight(pointer) {
        if (!this.isInTargetMode || !this.selectedPlayer) return;
        
        const {gridX, gridY} = this.hexGridManager.pointerToHexGrid(pointer);
        
        // Calculate distance from player to highlight center
        const playerX = this.selectedPlayer.gridX;
        const playerY = this.selectedPlayer.gridY;
        const distance = hexDistance(playerX, playerY, gridX, gridY);
        
        // Check if the target is within range (player's distance + 2)
        if (this.hexGridManager.isValidGridPosition(gridX, gridY) && distance <= this.selectedPlayer.distance + 2) {
            // Clear previous spell highlights but keep target range
            this.hexGridManager.clearHighlightOfType(HighlightType.SPELL);
            
            // Highlight spell area with direct gridMap reference
            this.hexGridManager.highlightSpellRadius(
                gridX, 
                gridY, 
                this.targetModeSize,
                this.gridMap,
                player => this.isAlly(player)
            );
        }
    }

    clearSpellHighlights() {
        // Restore the target range highlights
        if (this.selectedPlayer) {
            // First clear all highlights
            this.hexGridManager.clearHighlight();
            
            // Then reapply the target range
            this.hexGridManager.highlightTargetRange(
                this.selectedPlayer.gridX,
                this.selectedPlayer.gridY,
                this.selectedPlayer.distance
            );
        }
    }

    hasObstacle(gridX: number, gridY: number) {
        return this.hexGridManager.hasObstacle(gridX, gridY);
    }
}
