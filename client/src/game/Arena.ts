import { io } from 'socket.io-client';
import { Player } from './Player';
import { GameHUD, events } from '../components/HUD/GameHUD';
import { Team } from './Team';
import { MusicManager } from './MusicManager';
import { CellsHighlight } from './CellsHighlight';
import { getSpellById } from '@legion/shared/Spells';
import { lineOfSight, serializeCoords } from '@legion/shared/utils';
import { getFirebaseIdToken } from '../services/apiService';
import { allSprites } from '@legion/shared/sprites';
import { Target, Terrain, GEN, PlayMode } from "@legion/shared/enums";
import { TerrainUpdate, GameData, OutcomeData, PlayerNetworkData } from '@legion/shared/interfaces';
import { KILL_CAM_DURATION, BASE_ANIM_FRAME_RATE } from '@legion/shared/config';

import killzoneImage from '@assets/killzone.png';
import iceblockImage from '@assets/iceblock.png';

import potionHealImage from '@assets/vfx/potion_heal.png';
import explosionsImage from '@assets/vfx/explosions.png';
import thunderImage from '@assets/vfx/thunder.png';
import castImage from '@assets/vfx/cast.png';
import slashImage from '@assets/vfx/slash.png';
import boltsImage from '@assets/vfx/bolts.png';
import iceImage from '@assets/vfx/ice.png';
import ice2Image from '@assets/vfx/ice2.png';
import impactImage from '@assets/vfx/sword_impact.png';
import poisonImage from '@assets/vfx/poison.png';
import muteImage from '@assets/vfx/mute.png';

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
import cheerSFX from '@assets/sfx/cheer.wav';
import castSoundSFX from '@assets/sfx/spells/cast.wav';
import fireballSFX from '@assets/sfx/spells/fire_3.wav';
import thunderSoundSFX from '@assets/sfx/spells/thunder.wav';
import iceSoundSFX from '@assets/sfx/spells/ice.wav';
import healingSFX from '@assets/sfx/spells/healing.wav';
import poisonSoundSFX from '@assets/sfx/spells/poison.wav';
import muteSoundSFX from '@assets/sfx/spells/mute.wav';
import bgmStartSFX from '@assets/music/bgm_start.wav';
import bgmEndSFX from '@assets/music/bgm_end.wav';

import speechBubble from '@assets/speech_bubble.png';
import speechTail from '@assets/speech_tail.png';

// Static imports for tile atlas
import groundTilesImage from '@assets/tiles2.png';
import groundTilesAtlas from '@assets/tiles2.json';
import { errorToast, silentErrorToast } from '../components/utils';
import { Tutorial } from './Tutorial';
const LOCAL_ANIMATION_SCALE = 3;
const DEPTH_OFFSET = 0.01;

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
    highlight: Phaser.GameObjects.Graphics;
    cellsHighlight: CellsHighlight;
    localAnimationSprite: Phaser.GameObjects.Sprite;
    tileSize = 60;
    tilesMap: Map<string, Phaser.GameObjects.Image> = new Map<string, Phaser.GameObjects.Image>();
    obstaclesMap: Map<string, boolean> = new Map<string, boolean>();
    terrainSpritesMap: Map<string, Phaser.GameObjects.Sprite> = new Map<string, Phaser.GameObjects.Sprite>();
    gridWidth = 20;
    gridHeight = 9;
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
    tutorial;
    sfxVolume: number;
    inputLocked = false;

    constructor() {
        super({ key: 'Arena' });
        this.sfxVolume = this.getSFXVolumeFromLocalStorage();
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
        const frameConfig = { frameWidth: 144, frameHeight: 144};
        // Iterate over assetsMap and load spritesheets
        allSprites.forEach((sprite) => {
            this.load.spritesheet(sprite, require(`@assets/sprites/${sprite}.png`), frameConfig);
        });
        this.load.spritesheet('potion_heal', potionHealImage, { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('explosions', explosionsImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder2', thunderImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('cast', castImage, { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('slash', slashImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder', boltsImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice', iceImage, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice2', ice2Image, { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('impact', impactImage, { frameWidth: 291, frameHeight: 291});
        this.load.spritesheet('poison', poisonImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('mute', muteImage, { frameWidth: 64, frameHeight: 64});
        this.load.spritesheet('statuses', statusesImage, { frameWidth: 96, frameHeight: 96});

        this.load.audio('click', clickSFX);
        this.load.audio('slash', slashSFX);
        this.load.audio('steps', stepsSFX);
        this.load.audio('nope', nopeSFX);
        this.load.audio('heart', heartSFX);
        this.load.audio('cooldown', cooldownSFX);
        this.load.audio('shatter', shatterSFX);
        this.load.audio('flames', flamesSFX);
        this.load.audio('crowd', crowdSFX);
        this.load.audio('cheer', cheerSFX);

        // Load spell sounds
        this.load.audio('cast', castSoundSFX);
        this.load.audio('fireball', fireballSFX);
        this.load.audio('thunder', thunderSoundSFX);
        this.load.audio('ice', iceSoundSFX);
        this.load.audio('healing', healingSFX);
        this.load.audio('poison', poisonSoundSFX);
        this.load.audio('mute', muteSoundSFX);

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
            // console.log(`[Arena:progress] Progress: ${Math.floor(value * 100)}`);
            this.emitEvent('progressUpdate', Math.floor(value * 100));
        });

        this.load.on('complete', () => {
            this.emitEvent('progressUpdate', 100);
            // Remove listener
            this.load.off('progress');
            this.load.off('complete');
        });
        this.connectToServer();
    }

    extractGameIdFromUrl() {
        const pathArray = window.location.pathname.split('/');
        // Assuming the URL pattern is "/game/{gameId}", and "game" is always at a fixed position
        const gameIdIndex = pathArray.findIndex(element => element === 'game') + 1;
        return pathArray[gameIdIndex];
    }

    async connectToServer() {
        console.log('Connecting to the server ...');
        const gameId = this.extractGameIdFromUrl();
        this.socket = io(
            process.env.GAME_SERVER_URL,
            {
                auth: {
                    token: await getFirebaseIdToken(),
                    gameId,
                },
            }
        );

        // Queue socket events until the scene is created
        var onevent = this.socket.onevent;
        const scene = this;
        this.socket.onevent = function (packet) {
            if (!scene.sceneCreated){
                // console.warn('queueing ',packet.data[0]);
                scene.eventsQueue.push(packet);
            } else {
                onevent.call(this, packet);    // original call
            }
        };

        this.socket.on('connect', () => {
            // console.log('Connected to the server');
        });
        
        this.socket.on('disconnect', (reason) => {
            // console.log(`Disconnected from the server, ${reason}`);
            if (reason != 'io client disconnect') {
                // The disconnection was initiated by the server
                console.error(`Server disconnect during game: ${reason}`);
                const isTutorial = gameId === 'tutorial';
                if (isTutorial) {
                    silentErrorToast('Disconnected from server. Restarting tutorial...');
                } else {
                    silentErrorToast('Disconnected from server');
                }
                events.emit('serverDisconnect');
                this.destroy();
            } 
        }); 

        this.socket.on('error', (error) => {
            console.error('Error:', error);
            errorToast(`An error occurred: ${error}`);
        });

        this.socket.on('gameStatus', this.initializeGame.bind(this));

        this.socket.on('move',this.processMove.bind(this));

        this.socket.on('attack', (data) => {
            this.processAttack(data);
        });

        this.socket.on('obstacleattack', (data) => {
            this.processObstacleAttack(data);
        });

        this.socket.on('cooldown', (data) => {
            this.processCooldown(data);
        });

        this.socket.on('inventory', (data) => {
            this.processInventory(data);
        });

        this.socket.on('hpchange', (data) => {
            this.processHPChange(data);
        });

        this.socket.on('statuseffectchange', (data) => {
            this.processStatusChange(data);
        });

        this.socket.on('mpchange', (data) => {
            this.processMPChange(data);
        });

        this.socket.on('useitem', (data) => {
            this.processUseItem(data);
        });

        this.socket.on('cast', (data) => {
            this.processCast(true, data);
        });

        this.socket.on('endcast', (data) => {
            this.processCast(false, data);
        });

        this.socket.on('terrain', (data) => {
            this.processTerrain(data);
        });

        this.socket.on('gen', (data) => {
            if (Array.isArray(data)) {
                data.forEach(g => this.enqueueGEN(g));
            } else {
                this.enqueueGEN(data.gen);
            }
        });

        this.socket.on('localanimation', (data) => {
            this.processLocalAnimation(data);
        });

        this.socket.on('gameEnd', (data: OutcomeData) => {
            this.processGameEnd(data);
        });

        this.socket.on('score', (data) => {
            this.processScoreUpdate(data);
        });
    }

    sendMove(x, y) {
        const data = {
            tile: { x, y},
            num: this.selectedPlayer.num,
        };
        this.send('move', data);
    }

    sendAttack(player: Player) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            target: player.num,
            sameTeam: player.team.id === this.selectedPlayer.team.id,
        };
        this.send('attack', data);
        if (this.gameSettings.tutorial) events.emit('playerAttacked');
    }

    sendObstacleAttack(x, y) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            x,
            y,
        };
        this.send('obstacleattack', data);
    }

    sendSpell(x: number, y: number, player: Player | null) {
        if (!this.selectedPlayer || !this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            x,
            y,
            index: this.selectedPlayer.pendingSpell,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('spell', data);
        this.toggleTargetMode(false);
        this.selectedPlayer.pendingSpell = null;
        if (this.gameSettings.tutorial) events.emit('playerCastSpell');
    }

    sendUseItem(index: number, x: number, y: number, player: Player | null) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            x,
            y,
            index,
            targetTeam: player?.team.id,
            target: player?.num,
        };
        this.send('useitem', data);
        this.toggleItemMode(false);
        this.selectedPlayer.pendingItem = null;
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

    isSkip(x, y) {
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return true;
        const v = 3;
        const skip = y < this.gridHeight/2 ? Math.max(0, v - y - 1) : Math.max(0, y - (this.gridHeight - v));
        // Skip drawing the corners to create an oval shape
        return (x < skip || x >= this.gridWidth - skip);
    }

    floatTiles(duration) {
        const startX = this.gridCorners.startX;
        const startY = this.gridCorners.startY;
        // Loop over each row
        for (let y = 0; y < this.gridHeight; y++) {
            // In each row, loop over each column
            for (let x = 0; x < this.gridWidth; x++) {
                
                if (this.isSkip(x, y)) continue;
                this.floatOneTile(x, y, startX, startY, duration);
            }
        }

        if (duration > 0) {
            for (let x = -5; x < 1; x++) {
                for (let y = 1; y < 8; y++) {
                    this.floatOneTile(x, y, startX, startY, duration, true);
                }
            }

            for (let x = 19; x < 26; x++) {
                for (let y = 1; y < 8; y++) {
                    this.floatOneTile(x, y, startX, startY, duration, true);
                }
            }
        }
    }

    floatOneTile(x, y, startX, startY, duration, yoyo = false) {
        const tileWeights = {
            1: 15,
            2: 1,
            3: 1,
            4: 1,
            5: 1,
            6: 1,
            7: 1,
            8: 1,
        };
        const tiles = [];
        for (const tile in tileWeights) {
            for (let i = 0; i < tileWeights[tile]; i++) {
                tiles.push(parseInt(tile));
            }
        }

        const tile = tiles[Math.floor(Math.random() * tiles.length)];
        const tileSprite = this.add.image(startX + x * this.tileSize, startY + y * this.tileSize + this.scale.gameSize.height, 'groundTiles', `tile_${tile}`)
            .setDepth(1)
            .setOrigin(0); 

        // 50% chance of horizontal flip
        if (Math.random() > 0.5) {
            tileSprite.setFlipX(true);
        }
    
        const delay = duration > 0 ? Math.random() * 500 : 0;
        // Tween the tile to its intended position
        this.tweens.add({
            targets: tileSprite,
            y: startY + y * this.tileSize,
            duration,
            ease: 'Power2', // easing function to make the movement smooth
            delay,
            yoyo, // Enable yoyo to make the tween reverse after completing
            hold: yoyo ? 2000 : 0, // Holds the end position before reversing (optional, adjust as needed)
            repeat: 0, // No repeats, just go there and back again
            onComplete: () => {
                // Add a random delay before starting the wobble effect to desynchronize tiles
                this.time.addEvent({
                    delay: Phaser.Math.Between(0, 500), // random delay
                    callback: () => {
                        // Wobble effect tween
                        // @ts-ignore
                        tileSprite.tween = this.tweens.add({
                            targets: tileSprite,
                            y: `+=2`, // change the tile position by 10 pixels
                            duration: 1000, // duration of the tween in milliseconds
                            ease: 'Sine.easeInOut', // easing function to make the movement smooth
                            repeat: -1, // repeat the tween indefinitely
                            yoyo: true, // reverse the tween at the end
                        });
                    },
                    callbackScope: this,
                    loop: false
                });
            }
        });

        // Set up an interactive event
        // tileSprite.setInteractive();

        // // Highlight on pointer over
        // tileSprite.on('pointerover', function () {
        //     // this.setTint(0xffff00);
        //     this.setTint(0xff0000);
        // });

        // Clear tint on pointer out
        // tileSprite.on('pointerout', function () {
        //     this.clearTint();
        // });

        // @ts-ignore
        this.tilesMap.set(serializeCoords(x, y), tileSprite);

    }

    setUpArena() {
        // this.cameras.main.setZoom(1.5);

        const totalWidth = this.tileSize * this.gridWidth;
        const totalHeight = this.tileSize * this.gridHeight;

        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        const verticalOffset = 80;
        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + verticalOffset;

        this.gridCorners = {
            startX,
            startY,
        };

        this.cellsHighlight = new CellsHighlight(this, this.gridWidth, this.gridHeight, this.tileSize, this.gridCorners).setDepth(1);
        this.cellsHighlight.setDepth(2);

         // Add a pointer move handler to highlight the hovered tile
         this.input.on('pointermove', function (pointer) {
             const pointerX = pointer.x - startX;
             const pointerY = pointer.y - startY;
 
             // Calculate the grid coordinates of the pointer
             const gridX = Math.floor(pointerX / this.tileSize);
             const gridY = Math.floor(pointerY / this.tileSize);
 
             if (this.gameInitialized) this.cellsHighlight.move(gridX, gridY);
         }, this);

         // Add a pointer down handler to print the clicked tile coordinates
        this.input.on('pointerdown', function (pointer) {
            if (pointer.rightButtonDown()) {
                this.selectedPlayer?.cancelSkill();
                return;
            }

            const pointerX = pointer.x - startX;
            const pointerY = pointer.y - startY;

            // Calculate the grid coordinates of the pointer
            const gridX = Math.floor(pointerX / this.tileSize);
            const gridY = Math.floor(pointerY / this.tileSize);

            if (this.isSkip(gridX, gridY)) return;

            // Ensure the pointer is within the grid
            if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                this.handleTileClick(gridX, gridY);
            }
        }, this);

        this.input.keyboard.on('keydown', this.handleKeyDown, this);
    }

    toggleTargetMode(flag: boolean, size?: number) {
        if (flag) {
            this.cellsHighlight.setTargetMode(size, true);
            this.clearHighlight();
            this.emitEvent('pendingSpell');
        } else {
            this.cellsHighlight.setNormalMode(true);
            this.emitEvent('clearPendingSpell');
        }
    }

    toggleItemMode(flag: boolean) {
        if (flag) {
            this.cellsHighlight.setItemMode(true);
            this.clearHighlight();
            this.emitEvent('pendingItem');
        } else {
            this.cellsHighlight.setNormalMode(true);
            this.emitEvent('clearPendingItem');
        }
    }

    handleKeyDown(event) {
        // Check if the pressed key is a number
        const isNumberKey = (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NINE) || (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NUMPAD_NINE);
        if (isNumberKey) {
            let number;
            if (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NINE) {
                // Convert the key code to a number
                number = event.keyCode - Phaser.Input.Keyboard.KeyCodes.ZERO;
            } else if (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NUMPAD_NINE) {
                // Convert the key code to a number (for numpad keys)
                number = event.keyCode - Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO;
            } 
            this.teamsMap.get(this.playerTeamId)?.getMember(number)?.onClick();
        } else {
            const isLetterKey = (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.A && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.Z);
            if (isLetterKey) {
                // Get the letter corresponding to the keyCode
                const letter = String.fromCharCode(event.keyCode);
                this.selectedPlayer?.onLetterKey(letter);
                // Play sound
                this.sound.play('click');
                this.emitEvent('letterKey', letter);
            }
        }
    }

    isFree(gridX, gridY) {
        return !this.gridMap.get(serializeCoords(gridX, gridY)) && !this.obstaclesMap.get(serializeCoords(gridX, gridY));
    }

    hasPlayer(gridX, gridY) {
        return this.gridMap.has(serializeCoords(gridX, gridY));
    }

    hasObstacle(gridX, gridY) {
        return this.obstaclesMap.has(serializeCoords(gridX, gridY));
    }

    handleTileClick(gridX, gridY) {
        if (this.inputLocked) {
            this.unlockInput();
            return;
        }
        console.log(`Clicked tile at grid coordinates (${gridX}, ${gridY})`);
        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        const pendingSpell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
        const pendingItem = this.selectedPlayer?.inventory[this.selectedPlayer?.pendingItem];
        if (pendingSpell != null) {
            // console.log(`Casting spell ${pendingSpell.name}`);
            this.sendSpell(gridX, gridY, player);
        } else if (this.selectedPlayer?.pendingItem != null) {
            // console.log(`Using item ${pendingItem.name}`)
            this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
        } else if ((!player || !player.isAlive()) && this.hasObstacle(gridX, gridY)) {
            // console.log(`Clicked on obstacle at (${gridX}, ${gridY})`);
            this.sendObstacleAttack(gridX, gridY);
        } else if (this.selectedPlayer && !player) {
            // console.log(`Moving to (${gridX}, ${gridY})`);
            this.handleMove(gridX, gridY);
        } else if (player){ 
            // console.log(`Clicked on player ${player.num}`);
            if (pendingSpell?.target === Target.SINGLE) {
                this.sendSpell(gridX, gridY, player);
            } if (pendingItem?.target === Target.SINGLE) {
                this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
            } else {
                player.onClick();
            }
        } else {
            console.log(`Clicked on empty tile at (${gridX}, ${gridY})`);
        }
    }

    handleMove(gridX, gridY) {
        if (!this.selectedPlayer.canMoveTo(gridX, gridY)) return;
        if (!this.isFree(gridX, gridY)) return;
        this.playSound('click');
        this.sendMove(gridX, gridY);
        this.clearHighlight();
        if (this.gameSettings.tutorial) events.emit('playerMoved');
    }

    refreshBox() {
        if (this.selectedPlayer) {
            events.emit('showPlayerBox', this.selectedPlayer.getProps());
        }
    }
    
    refreshOverview() {
        const { team1, team2, general, initialized } = this.getOverview();
        if (this.overviewReady) {
            events.emit('updateOverview', team1, team2, general, initialized);
        }
    }

    showEndgameScreen(data: OutcomeData) {
        if (this.overviewReady) events.emit('gameEnd', data);
    }

    emitEvent(event, data?) {
        switch (event) {
            case 'hpChange':
                if (this.selectedPlayer && data.num === this.selectedPlayer.num) {
                    this.refreshBox();
                }
                this.refreshOverview();
                break;
            case 'pendingSpellChange':
            case 'pendingItemChange':
            case 'selectPlayer':
            case 'inventoryChange':
                this.refreshBox();
                break;
            case 'deselectPlayer':
                events.emit('hidePlayerBox');
                break;
            case 'mpChange':
            case 'statusesChange':
            case 'cooldownStarted':
            case 'cooldownEnded':
            case 'cooldownChange':
                this.refreshBox();
                this.refreshOverview();
                break;
            case 'overviewChange':
                this.refreshOverview();
                break;
            case 'letterKey':
                if (this.selectedPlayer) {
                    events.emit('keyPress', data);
                }
                break;
            case 'gameEnd':
                this.showEndgameScreen(data);
                break;
            case 'hoverCharacter':
                events.emit('hoverCharacter');
                break;
            case 'unhoverCharacter':
                events.emit('unhoverCharacter');
                break;
            case 'hoverEnemyCharacter':
                events.emit('hoverEnemyCharacter');
                break;
            case 'pendingSpell':
                events.emit('pendingSpell');
                break;
            case 'pendingItem':
                events.emit('pendingItem');
                break;
            case 'clearPendingSpell':
                events.emit('clearPendingSpell');
                break;
            case 'clearPendingItem':
                events.emit('clearPendingItem');
                break;
            case 'progressUpdate':
                events.emit('progressUpdate', data);
                break;
            default:
                break;
        }
    }

    selectPlayer(player: Player) {
        if (!this.gameInitialized) return;
        if (this.selectedPlayer) {
            const isSelf = player.num === this.selectedPlayer.num;
            this.deselectPlayer();
            if (isSelf) return;
        }
        this.selectedPlayer = player;
        this.selectedPlayer.select();
        this.emitEvent('selectPlayer', {num: this.selectedPlayer.num})
    }

    deselectPlayer() {
        if (this.selectedPlayer) {
            this.selectedPlayer.deselect();
            this.selectedPlayer.cancelSkill();
            this.selectedPlayer = null;
            this.clearHighlight();
            this.emitEvent('deselectPlayer')
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
            console.error(`[processMove] Player ${num} not found`);
            return;
        }

        // this.gridMap.set(serializeCoords(player.gridX, player.gridY), null);
        this.gridMap.delete(serializeCoords(player.gridX, player.gridY));
        this.gridMap.set(serializeCoords(tile.x, tile.y), player);

        player.walkTo(tile.x, tile.y);
        this.playSoundMultipleTimes('steps', 2);
    }

    processAttack({team, target, num, damage, hp, isKill, sameTeam}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        const otherTeam = sameTeam ? team : this.getOtherTeam(team);
        const targetPlayer = this.getPlayer(otherTeam, target);

        const {x: pixelX, y: pixelY} = this.gridToPixelCoords(targetPlayer.gridX, targetPlayer.gridY);
        if (isKill) this.killCam(pixelX, pixelY);
        
        this.playSound('slash');
        player.attack(targetPlayer.gridX);
        targetPlayer.setHP(hp);
        targetPlayer.displaySlash(player);   
        this.displayAttackImpact(targetPlayer.gridX, targetPlayer.gridY);    
    }

    processObstacleAttack({team, num, x, y}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        this.playSound('slash');
        this.playSound('shatter');
        player.attack(x);
        this.displayAttackImpact(x, y);
    }

    processCooldown({num, cooldown}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(this.playerTeamId, num);
        player.setCooldown(cooldown);
    }

    processInventory({num, inventory}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(this.playerTeamId, num);
        player.setInventory(inventory);
        this.emitEvent('inventoryChange', {num});
    }

    processHPChange({team, num, hp, damage}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player.setHP(hp);
        if (damage) player.displayDamage(damage);
    }

    processStatusChange({team, num, statuses}) {
        if (this.gameEnded) return;
        const player = this.getPlayer(team, num);
        player.setStatuses(statuses);
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
    }

    processCast(flag, {team, num, id, location,}) {
        if (this.gameEnded) return;
        // console.log(`Processing cast: ${flag} ${team} ${num} ${id} ${location}`);
        const player = this.getPlayer(team, num);
        const spell = getSpellById(id);
        player.castAnimation(flag, spell?.name);
        if (flag) this.displaySpellArea(location, spell.size, spell.castTime);
    }

    processTerrain(updates: TerrainUpdate[]) {
        if (this.gameEnded) return;
        updates.forEach(({x, y, terrain}) => {
            const {x: pixelX, y: pixelY} = this.gridToPixelCoords(x, y);
            switch (terrain) {
                case Terrain.FIRE:
                    const sprite = this.add.sprite(pixelX, pixelY, '')
                        .setDepth(this.yToZ(y)).setScale(2).setAlpha(0.9);
                    this.addFlames();
                    sprite.on('destroy', () => {
                        this.removeFlames();
                    });
                    sprite.anims.play('ground_flame');
                    this.sprites.push(sprite);
                    this.terrainSpritesMap.set(serializeCoords(x, y), sprite);
                    break;
                case Terrain.ICE:
                    const icesprite = this.createIceBlock(x, y);
                    this.terrainSpritesMap.set(serializeCoords(x, y), icesprite);
                    
                    const tile = this.tilesMap.get(serializeCoords(x, y));
                    // @ts-ignore
                    if (tile.tween) tile.tween.stop();
                    this.obstaclesMap.set(serializeCoords(x, y), true);
                  
                    break;
                case Terrain.NONE:
                    this.obstaclesMap.delete(serializeCoords(x, y));
                    const terrainsprite = this.terrainSpritesMap.get(serializeCoords(x, y));
                    if (terrainsprite) {
                        this.flickerAndDestroy(terrainsprite, 5, 1000);
                        this.terrainSpritesMap.delete(serializeCoords(x, y));
                    }
                    break;
                default:
                    break;
            }
        });
    }

    createIceBlock(x: number, y: number) {
        const {x: pixelX, y: pixelY} = this.gridToPixelCoords(x, y);
        const depth = this.yToZ(y) + DEPTH_OFFSET;
        const icesprite = this.add.sprite(pixelX, pixelY, 'iceblock')
            .setDepth(depth).setAlpha(0.9).setOrigin(0.5, 0.35).setInteractive();
        // Add pointerover event to sprite
        icesprite.on('pointerover', () => {
            if (this.selectedPlayer?.isNextTo(x, y) 
                && this.selectedPlayer.canAct()
                && this.selectedPlayer.pendingSpell == null
                && this.selectedPlayer.pendingItem == null) {
                this.emitEvent('hoverEnemyCharacter');
            } 
        });
        // Add pointerout event to sprite
        icesprite.on('pointerout', () => {
            this.emitEvent('unhoverCharacter');
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
        const {x: pixelX, y: pixelY} = this.gridToPixelCoords(gridX, gridY);
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
        const {x: pixelX, y: pixelYInitial} = this.gridToPixelCoords(x, y);
        let pixelY = pixelYInitial;
        if (spell.yoffset) pixelY += spell.yoffset;

        if (isKill) this.killCam(pixelX, pixelY);

        const scale = spell.scale > 1 ? spell.scale : LOCAL_ANIMATION_SCALE;
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

    processGameEnd(data: OutcomeData) {
        this.musicManager.playEnd();
        const winningTeam = data.isWinner ? this.teamsMap.get(this.playerTeamId) : this.teamsMap.get(this.getOtherTeam(this.playerTeamId));
        setTimeout(() => {
            winningTeam?.members.forEach((player) => {
                player.victoryDance();
            });
        }, 200);
        this.emitEvent('gameEnd', data);
    }

    processScoreUpdate({score}) {
        // console.log(`Team ${teamId} score updated to ${score}`);
        const team = this.teamsMap.get(this.playerTeamId);
        const _score = team.score;
        team.setScore(score);
        this.emitEvent('overviewChange');
        if (score - _score > 50) this.playSound('cheer', 2);
    }

    updateMusicIntensity(ratio){
        this.musicManager.updateMusicIntensity(ratio);
    }

    createSounds() {
        this.SFX = {};
        const sounds = ['click', 'slash', 'steps', 'nope', 'heart', 'cooldown', 'fireball','healing',
            'cast', 'thunder', 'ice', 'shatter', 'flames', 'crowd', 'cheer', 'poison', 'mute']
        sounds.forEach((sound) => {
            this.SFX[sound] = this.sound.add(sound);
        })

        // Listen for settings changes
        events.on('settingsChanged', this.onSettingsChanged, this);
    }

    onSettingsChanged = (settings) => {
        this.sfxVolume = settings.sfxVolume / 100;
    }

    playSound(name, volume = 1, loop = false) {
        const adjustedVolume = volume * this.sfxVolume;
        this.SFX[name].play({delay: 0, volume: adjustedVolume, loop});
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
            this.anims.create({
                key: `${asset}_anim_idle`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 9, end: 11 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
                repeat: -1,
                yoyo: true 
            });

            this.anims.create({
                key: `${asset}_anim_idle_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 33, end: 35 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
                repeat: -1, // Loop indefinitely,
                yoyo: true
            });

            this.anims.create({
                key: `${asset}_anim_walk`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 6, end: 8 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
                repeat: -1 // Loop indefinitely
            });

            this.anims.create({
                key: `${asset}_anim_attack`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 12, end: 14 }), 
                frameRate: BASE_ANIM_FRAME_RATE * 2, 
            });

            this.anims.create({
                key: `${asset}_anim_dodge`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 45, end: 47 }), 
                frameRate: BASE_ANIM_FRAME_RATE * 2, 
            });

            this.anims.create({
                key: `${asset}_anim_item`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 48, end: 50 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
            });

            this.anims.create({
                key: `${asset}_anim_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 42, end: 44 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
            });

            this.anims.create({
                key: `${asset}_anim_cast`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 39, end: 41 }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
            });

            this.anims.create({
                key: `${asset}_anim_die`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [51, 52, 53] }), 
                frameRate: BASE_ANIM_FRAME_RATE * 2, 
            });

            this.anims.create({
                key: `${asset}_anim_victory`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [15, 16, 17] }), 
                frameRate: BASE_ANIM_FRAME_RATE, 
                repeat: -1,
                yoyo: true 
            });

            this.anims.create({
                key: `${asset}_anim_boast`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [15, 16, 17] }), 
                frameRate: BASE_ANIM_FRAME_RATE * 2, 
                repeat: 2,
                yoyo: true 
            });
        }, this);

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

    gridToPixelCoords(gridX, gridY) {
        return {
            x: gridX * this.tileSize + this.gridCorners.startX + 30,
            y: gridY * this.tileSize + this.gridCorners.startY - 10,
        };
    }

    placeCharacters(data: PlayerNetworkData[], isPlayer: boolean, team: Team, isReconnect = false) {
        data.forEach((character: PlayerNetworkData, i) => {
            const {x, y} = this.gridToPixelCoords(character.x, character.y);

            const player = new Player(
                this, this, team, character.name, character.x, character.y, x, y,
                i + 1, character.frame, isPlayer, character.class,
                character.hp, character.maxHP, character.mp, character.maxMP,
                character.level, character.xp,
                );
            
            if (isPlayer) {
                player.setDistance(character.distance);
                player.setCooldown(1); // hack
                player.setInventory(character.inventory);
                player.setSpells(character.spells);
            }
            player.setStatuses(character.statuses);

            // Stagger the entrance of each player with a random offset between -200 and +200 ms
            const randomOffset = Math.floor(Math.random() * 401) - 200; // Random number between -200 and 200
            const entranceDelay = 750 + randomOffset;
            this.time.delayedCall(entranceDelay, player.makeAirEntrance, [this.gameSettings.tutorial], player);

            this.gridMap.set(serializeCoords(character.x, character.y), player);

            team.addMember(player);
        }, this);
    }
  
    isValidCell(fromX, fromY, toX, toY) {
        return !this.isSkip(toX, toY)
        && this.isFree(toX, toY)
        && lineOfSight(fromX, fromY, toX, toY, this.isFree.bind(this));
    }

    highlightCells(gridX, gridY, radius) {
        // Create a new Graphics object to highlight the cells
        if (!this.highlight) this.highlight = this.add.graphics().setDepth(1);
        this.clearHighlight();
        this.highlight.fillStyle(0xffd700, 0.7); // Use golden color
    
        // Iterate over each cell in the grid
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                // Check if the cell is within the circle
                if (x * x + y * y <= radius * radius) {
                    if(!this.isValidCell(gridX, gridY, gridX + x, gridY + y)) continue;
                    // Calculate the screen position of the cell
                    const posX = this.gridCorners.startX + (gridX + x) * this.tileSize;
                    const posY = this.gridCorners.startY + (gridY + y) * this.tileSize;
    
                    // Draw a rectangle around the cell
                    this.highlight.fillRect(posX, posY, this.tileSize, this.tileSize);
                }
            }
        }
    }

    clearHighlight() {
        if (this.highlight) this.highlight.clear();
    }
    
    // PhaserCreate
    create()
    {
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
            mode: null,
        }

        // console.log(`[Arena:create] Scene created`);
        this.sceneCreated = true;
        this.emptyQueue();
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
    

    displaySpellArea(location, size, duration) {
        if (size % 2 === 0) {
            location.x += 0.5;
            location.y += 0.5;
        }
        const {x, y} = this.gridToPixelCoords(location.x, location.y);
        const spellAreaImage = this.add.image(x + 2, y + 42, 'killzone')
            .setDepth(1)
            .setDisplaySize(size * this.tileSize, size * this.tileSize)
            .setOrigin(0.5)
            .setAlpha(0.5);
            // .setTint(0xff0000);

        const blinkDuration = 100;
        const totalDuration = duration * 1000; // Convert to milliseconds
        const repeatCount = Math.floor(totalDuration / blinkDuration / 2);
    
        this.tweens.add({
            targets: spellAreaImage,
            alpha: { from: 1, to: 0.5 }, // From fully visible to invisible
            duration: blinkDuration,    // Duration for each blink
            yoyo: true,                 // Go back and forth between visible and invisible
            repeat: repeatCount - 1,    // Number of blinks (or -1 for infinite)
            onComplete: () => {
                spellAreaImage.destroy(); // Destroy the image at the end
            }
        });
    }

    initializeGame(data: GameData): void {
        const isReconnect = data.general.reconnect || this.isLateToTheParty;

        this.playerTeamId = data.player.teamId;

        if(this.playerTeamId === undefined) {
            console.error('Player team id is undefined');
        }

        data.general.mode = PlayMode.TUTORIAL; // TODO: Remove this
        this.gameSettings.tutorial = (data.general.mode == PlayMode.TUTORIAL);
        this.gameSettings.spectator = data.general.spectator;
        this.gameSettings.mode = data.general.mode;

        this.teamsMap.set(data.player.teamId, new Team(this, data.player.teamId, true, data.player.player, data.player.score));
        this.teamsMap.set(data.opponent.teamId, new Team(this, data.opponent.teamId, false, data.opponent.player));

        this.placeCharacters(data.player.team, true, this.teamsMap.get(data.player.teamId), isReconnect);
        this.placeCharacters(data.opponent.team, false, this.teamsMap.get(data.opponent.teamId), isReconnect);

        const tilesDelay = isReconnect ? 0 : 1000;
        this.floatTiles(tilesDelay);

        this.processTerrain(data.terrain); // Put after floatTiles() to allow for tilesMap to be intialized

        if (this.gameSettings.tutorial) {
            this.tutorial = new Tutorial(this, this.gamehud);
            this.tutorial.start();
        }

        if (isReconnect) {
            this.setGameInitialized();
        } else {
            const delay = 3000;
            setTimeout(this.updateOverview.bind(this), delay + 1000);
            setTimeout(() => {
                if (!this.gameSettings.tutorial) this.displayGEN(GEN.COMBAT_BEGINS);
                this.setGameInitialized();

                if (this.gameSettings.tutorial) {
                    this.tutorial.start();
                }
            }, delay);
        }

        // Events from the HUD
        events.on('itemClick', (keyIndex) => {
            this.selectedPlayer?.onKey(keyIndex);
        });

        events.on('abandonGame', () => {
            this.abandonGame();
        });

        events.on('exitGame', () => {
            console.log('Exit game event received');
            this.destroy();
        });
        
        events.emit('gameInitialized');
    }

    sleep(duration: number): Promise<void> {
        return new Promise(resolve => {
            this.time.delayedCall(duration, resolve, [], this);
        });
    }
    
    setGameInitialized() {
        this.gameInitialized = true;
        this.updateOverview();
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
        if (this.isDisplayingGEN || this.killCamActive || this.genQueue.length === 0) {
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
        return new Promise((resolve) => {
            if (this.killCamActive) {
                // If kill cam is active, re-enqueue the GEN and resolve immediately
                this.genQueue.unshift(gen);
                resolve();
                return;
            }

            let text1, text2;

            switch (gen) {
                case GEN.COMBAT_BEGINS:
                    text1 = 'combat';
                    text2 = 'begins';
                    break;
                case GEN.MULTI_KILL:
                    text1 = 'multi';
                    text2 = 'kill';
                    break;
                case GEN.MULTI_HIT:
                    text1 = 'multi';
                    text2 = 'hit';
                    break;
                case GEN.ONE_SHOT:
                    text1 = 'one';
                    text2 = 'shot';
                    break;
                case GEN.FROZEN:
                    text1 = 'frozen';
                    break;
                case GEN.BURNING:
                    text1 = 'stuff-is';
                    text2 = 'on-fire';
                    break;
                case GEN.TUTORIAL:
                    text1 = 'tutorial';
                    break;
                default:
                    resolve();
                    return;
            }

            // Setup GEN Background
            const textTweenDuration = 600;
            const textDelay = 400;
            const yOffset = 20;
            const bgYPosition = (this.cameras.main.centerY / 2 + yOffset);
            const yPosition = this.cameras.main.centerY - 200 + yOffset;

            let genBg = this.add.image(this.cameras.main.centerX, bgYPosition, 'gen_bg');
            genBg.setAlpha(0).setDepth(10);
            this.tweens.add({
                targets: genBg,
                alpha: 0.7,
                duration: 200,
                ease: 'Power2',
            });

            // Setup GEN Texts
            const targets = [
                this.add.image(-350, yPosition, text1).setDepth(10),
                this.add.image(this.cameras.main.width + 100, yPosition, 'blue_bang').setDepth(10)
            ];
            if (text2) {
                targets.push(
                    this.add.image(this.cameras.main.width + 100, yPosition, text2).setDepth(10)
                );
            }

            // Animate GEN Texts into View
            this.tweens.add({
                targets,
                x: this.cameras.main.centerX,
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
     

    updateOverview() {
        this.overviewReady = true;
        this.emitEvent('overviewChange');
    }

    getOverview() {
        const overview =  {
            team1: this.teamsMap.get(1).getOverview(),
            team2: this.teamsMap.get(2).getOverview(),
            general: this.gameSettings,
            initialized: this.gameInitialized,
        };
        return overview;
    }

    killCam(x, y) {
        this.killCamActive = true;
        // Save the original zoom and time scale
        const originalZoom = this.cameras.main.zoom;
        const originalTimeScale = this.localAnimationSprite.anims.timeScale;
        const originalSoundRate = this.sound.rate;
        const originalTweenRate = this.tweens.timeScale;

        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
    
        // Define target zoom and slow-motion scale
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
        const secondDelay = firstDelay + KILL_CAM_DURATION;
        const cameraSpeed = 200;

        this.time.delayedCall(firstDelay, () => {
            // Move camera to the spell's location and zoom in
            this.cameras.main.pan(x, y, cameraSpeed, 'Power2');
            this.cameras.main.zoomTo(targetZoom, cameraSpeed, 'Power2');
        });
          
        this.time.delayedCall(secondDelay, () => {
            // Return the camera to the original position and zoom level
            this.cameras.main.pan(screenWidth / 2, screenHeight / 2, cameraSpeed, 'Power2');
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
        this.gameEnded = true;
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
        this.scene.stop();

        // Clean up any other resources or listeners
        events.removeAllListeners();
        events.off('settingsChanged', this.onSettingsChanged, this);
    }

    // update (time, delta)
    // {
    // }
}