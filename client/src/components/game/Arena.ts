
import { io } from 'socket.io-client';
import { Player } from './Player';
import { GameHUD, events } from './HUD/GameHUD';
import { Team } from './Team';
import { MusicManager } from './MusicManager';
import { CellsHighlight } from './CellsHighlight';
import { getSpellById } from '@legion/shared/Spells';
import { lineOfSight, serializeCoords } from '@legion/shared/utils';
import { getFirebaseIdToken } from '../../services/apiService';
import { allSprites } from '@legion/shared/sprites';
import { Target, Terrain } from "@legion/shared/enums";
import { TerrainUpdate } from '@legion/shared/interfaces';

const LOCAL_ANIMATION_SCALE = 3;
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

    constructor() {
        super({ key: 'Arena' });
    }

    preload ()
    {
        this.gamehud = new GameHUD();
        
        this.load.image('bg',  'aarena_bg.png');
        this.load.image('killzone',  'killzone.png');
        this.load.image('iceblock',  'iceblock.png');
        const frameConfig = { frameWidth: 144, frameHeight: 144};
        // Iterate over assetsMap and load spritesheets
        allSprites.forEach((sprite) => {
            this.load.spritesheet(sprite, `sprites/${sprite}.png`, frameConfig);
        });
        this.load.spritesheet('potion_heal', 'vfx/potion_heal.png', { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('explosions', 'vfx/explosions.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('cast', 'vfx/cast.png', { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('slash', 'vfx/slash.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder', 'vfx/bolts.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice', 'vfx/ice.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('impact', 'vfx/sword_impact.png', { frameWidth: 291, frameHeight: 291});

        this.load.spritesheet('statuses', 'States.png', { frameWidth: 96, frameHeight: 96});

        this.load.audio('click', 'sfx/click_2.wav');
        this.load.audio('slash', 'sfx/swish_2.wav');
        this.load.audio('steps', 'sfx/steps.wav');
        this.load.audio('nope', 'sfx/nope.wav');
        this.load.audio('heart', 'sfx/heart.wav');
        this.load.audio('cooldown', 'sfx/cooldown.wav');
        this.load.audio('shatter', 'sfx/shatter.wav');
        this.load.audio('flames', 'sfx/flame.wav');

        this.load.audio('cast', 'sfx/spells/cast.wav');
        this.load.audio('fireball', 'sfx/spells/fire_3.wav');
        this.load.audio('thunder', 'sfx/spells/thunder.wav');
        this.load.audio('ice', 'sfx/spells/ice.wav');
        this.load.audio('healing', 'sfx/spells/healing.wav');


        this.load.audio(`bgm_start`, `music/bgm_start.wav`);
        for (let i = 2; i <= 13; i++) {
            this.load.audio(`bgm_loop_${i}`, `music/bgm_loop_${i}.wav`);
        }
        this.load.audio(`bgm_end`, `music/bgm_end.wav`);

        this.load.atlas('groundTiles', 'tiles2.png', 'tiles2.json');

    }

    extractGameIdFromUrl() {
        const pathArray = window.location.pathname.split('/');
        // Assuming the URL pattern is "/game/{gameId}", and "game" is always at a fixed position
        const gameIdIndex = pathArray.findIndex(element => element === 'game') + 1;
        return pathArray[gameIdIndex];
    }

    async connectToServer() {
        const gameId = this.extractGameIdFromUrl();
        console.log('Game ID:', gameId);

        this.socket = io(
            process.env.GAME_SERVER_URL,
            {
                auth: {
                    token: await getFirebaseIdToken(),
                    gameId,
                },
            }
        );

        this.socket.on('connect', () => {
            console.log('Connected to the server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from the server');
        }); 

        this.socket.on('gameStatus', this.initializeGame.bind(this));

        this.socket.on('move', (data) => {
            this.processMove(data);
        });

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

        this.socket.on('localanimation', (data) => {
            this.processLocalAnimation(data);
        });

        this.socket.on('gameEnd', (data) => {
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
        };
        this.send('attack', data);
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

    floatTiles(startX, startY) {

        // Loop over each row
        for (let y = 0; y < this.gridHeight; y++) {
            // In each row, loop over each column
            for (let x = 0; x < this.gridWidth; x++) {
                
                if (this.isSkip(x, y)) continue;
                this.floatOneTile(x, y, startX, startY);
            }
        }

        for (let x = -5; x < 1; x++) {
            for (let y = 1; y < 8; y++) {
                this.floatOneTile(x, y, startX, startY, true);
            }
        }

        for (let x = 19; x < 26; x++) {
            for (let y = 1; y < 8; y++) {
                this.floatOneTile(x, y, startX, startY, true);
            }
        }
    }

    floatOneTile(x, y, startX, startY, yoyo = false) {
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
    
        // Tween the tile to its intended position
        this.tweens.add({
            targets: tileSprite,
            y: startY + y * this.tileSize,
            duration: 1000, // duration of the tween in milliseconds
            ease: 'Power2', // easing function to make the movement smooth
            delay: Math.random() * 500, // random delay to make the tiles fall at different times
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
        const totalWidth = this.tileSize * this.gridWidth;
        const totalHeight = this.tileSize * this.gridHeight;

        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + 150;

        this.floatTiles(startX, startY);

        this.gridCorners = {
            startX,
            startY,
        };

        this.cellsHighlight = new CellsHighlight(this, this.gridWidth, this.gridHeight, this.tileSize, this.gridCorners).setDepth(1);

         // Add a pointer move handler to highlight the hovered tile
         this.input.on('pointermove', function (pointer) {
             const pointerX = pointer.x - startX;
             const pointerY = pointer.y - startY;
 
             // Calculate the grid coordinates of the pointer
             const gridX = Math.floor(pointerX / this.tileSize);
             const gridY = Math.floor(pointerY / this.tileSize);
 
             this.cellsHighlight.move(gridX, gridY);
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

        // const bg = this.add.image(0, -230, 'bg').setOrigin(0, 0);

        // const scaleX = gameWidth / bg.width;
        // const scaleY = gameHeight / bg.height;
        // const scale = Math.max(scaleX, scaleY);
        // bg.setScale(scale).setAlpha(0.7);

        this.input.keyboard.on('keydown', this.handleKeyDown, this);
    }

    toggleTargetMode(flag: boolean, size?: number) {
        this.HUD.toggleCursor(flag, 'scroll');
        if (flag) {
            this.cellsHighlight.setTargetMode(size, true);
            this.clearHighlight();
        } else {
            this.cellsHighlight.setNormalMode(true);
        }
    }

    toggleItemMode(flag: boolean) {
        this.HUD.toggleCursor(flag, 'item');
        if (flag) {
            this.cellsHighlight.setItemMode(true);
            this.clearHighlight();
        } else {
            this.cellsHighlight.setNormalMode(true);
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

    hasObstacle(gridX, gridY) {
        return this.obstaclesMap.has(serializeCoords(gridX, gridY));
    }

    handleTileClick(gridX, gridY) {
        console.log(`Clicked tile at grid coordinates (${gridX}, ${gridY})`);
        if (!this.selectedPlayer?.canAct()) return;
        const player = this.gridMap.get(serializeCoords(gridX, gridY));
        const pendingSpell = this.selectedPlayer?.spells[this.selectedPlayer?.pendingSpell];
        const pendingItem = this.selectedPlayer?.inventory[this.selectedPlayer?.pendingItem];
        if (pendingSpell != null) {
            this.sendSpell(gridX, gridY, player);
        } else if (this.selectedPlayer?.pendingItem != null) {
            this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
        } else if (!player && this.hasObstacle(gridX, gridY)) {
            this.sendObstacleAttack(gridX, gridY);
        } else if (this.selectedPlayer && !player) {
            this.handleMove(gridX, gridY);
        } else if (player){ 
            if (pendingSpell?.target === Target.SINGLE) {
                this.sendSpell(gridX, gridY, player);
            } if (pendingItem?.target === Target.SINGLE) {
                this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY, player);
            } else {
                player.onClick();
            }
        }
    }

    handleMove(gridX, gridY) {
        if (!this.selectedPlayer.canMoveTo(gridX, gridY)) return;
        if (!this.isFree(gridX, gridY)) return;
        this.playSound('click');
        this.sendMove(gridX, gridY);
        this.clearHighlight();
    }

    refreshBox() {
        if (this.selectedPlayer) {
            events.emit('showPlayerBox', this.selectedPlayer.getProps());
        }
    }
    
    refreshOverview() {
        const { team1, team2 } = this.getOverview();
        if (this.overviewReady) events.emit('updateOverview', team1, team2);
    }

    showEndgameScreen({isWinner, xp, gold}) {
        if (this.overviewReady) events.emit('gameEnd', xp, gold);
    }

    emitEvent(event, data?) {
        switch (event) {
            case 'hpChange':
                if (this.selectedPlayer && data.num === this.selectedPlayer.num) {
                    this.refreshBox();
                }
                this.refreshOverview();
                break;
            case 'mpChange':
                this.refreshBox();
                this.refreshOverview();
                break;
            case 'selectPlayer':
                this.refreshBox();
                break;
            case 'deselectPlayer':
                events.emit('hidePlayerBox');
                break;
            case 'inventoryChange':
                this.refreshBox();
                break;
            case 'cooldownStarted':
                this.refreshBox();
                this.refreshOverview();
                break;
            case 'cooldownEnded':
                this.refreshBox();
                this.refreshOverview();
                break;
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
            default:
                break;
        }
    }

    selectPlayer(player: Player) {
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
        return this.teamsMap.get(team).getMember(num);
    }

    getOtherTeam(id: number): number {
        return id === 1 ? 2 : 1;
    }

    processMove({team, tile, num}) {
        const player = this.getPlayer(team, num);

        this.gridMap.set(serializeCoords(player.gridX, player.gridY), null);
        this.gridMap.set(serializeCoords(tile.x, tile.y), player);

        player.walkTo(tile.x, tile.y);
        this.playSoundMultipleTimes('steps', 2);
    }

    processAttack({team, target, num, damage, hp}) {
        const player = this.getPlayer(team, num);
        const otherTeam = this.getOtherTeam(team);
        const targetPlayer = this.getPlayer(otherTeam, target);
        this.playSound('slash');
        player.attack(targetPlayer.gridX);
        targetPlayer.setHP(hp);
        targetPlayer.displaySlash(player);   
        this.displayAttackImpact(targetPlayer.gridX, targetPlayer.gridY);    
    }

    processObstacleAttack({team, num, x, y}) {
        const player = this.getPlayer(team, num);
        this.playSound('slash');
        this.playSound('shatter');
        player.attack(x);
        this.displayAttackImpact(x, y);
    }

    processCooldown({num, cooldown}) {
        const player = this.getPlayer(this.playerTeamId, num);
        player.setCooldown(cooldown);
    }

    processInventory({num, inventory}) {
        const player = this.getPlayer(this.playerTeamId, num);
        player.setInventory(inventory);
        this.emitEvent('inventoryChange', {num});
    }

    processHPChange({team, num, hp, damage}) {
        const player = this.getPlayer(team, num);
        player.setHP(hp);
        if (damage) player.displayDamage(damage);
    }

    processStatusChange({team, num, statuses}) {
        const player = this.getPlayer(team, num);
        player.setStatuses(statuses);
    }

    processMPChange({num, mp}) {
        const player = this.getPlayer(this.playerTeamId, num);
        player.setMP(mp);
    }

    processUseItem({team, num, animation, name, sfx}) {
        const player = this.getPlayer(team, num);
        player.useItemAnimation(animation, name);
        this.playSound(sfx);
    }

    processCast(flag, {team, num, id, location,}) {
        // console.log(`Processing cast: ${flag} ${team} ${num} ${id} ${location}`);
        const player = this.getPlayer(team, num);
        const spell = getSpellById(id);
        player.castAnimation(flag, spell?.name);
        if (flag) this.displaySpellArea(location, spell.size, spell.castTime);
    }

    processTerrain(updates: TerrainUpdate[]) {
        updates.forEach(({x, y, terrain}) => {
            const {x: pixelX, y: pixelY} = this.gridToPixelCoords(x, y);
            switch (terrain) {
                case Terrain.FIRE:
                    const sprite = this.add.sprite(pixelX, pixelY, '')
                        .setDepth(3 + y/10).setScale(2).setAlpha(0.9);
                    this.addFlames();
                    sprite.on('destroy', () => {
                        this.removeFlames();
                    });
                    sprite.anims.play('ground_flame');
                    this.sprites.push(sprite);
                    this.terrainSpritesMap.set(serializeCoords(x, y), sprite);
                    break;
                case Terrain.ICE:
                    const icesprite = this.add.sprite(pixelX, pixelY, 'iceblock')
                        .setDepth(3 + y/10).setAlpha(0.9).setOrigin(0.5, 0.35);
                    icesprite.postFX.addShine(0.5, .2, 5);
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
            .setDepth(3.5 + gridY/10)
            .setScale(0.5)
            .play('impact');
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

        this.localAnimationSprite.setPosition(pixelX, pixelY)
            .setVisible(true)
            .setDepth(3.5 + y/10)
            .setScale(LOCAL_ANIMATION_SCALE)
            .play(spell.animation);
        this.playSound(spell.sfx);

        if (spell.shake) {
            const duration = isKill ? 2000 : 250;
            const intensity = 0.002;
            this.cameras.main.shake(duration, intensity);
         } 
    }

    processGameEnd({isWinner, xp, gold}) {
        // TODO: handle winner = -1 for errors
        this.musicManager.playEnd();
        const winningTeam = isWinner ? this.teamsMap.get(this.playerTeamId) : this.teamsMap.get(this.getOtherTeam(this.playerTeamId));
        setTimeout(() => {
            winningTeam.members.forEach((player) => {
                player.victoryDance();
            });
        }, 200);
        this.emitEvent('gameEnd', {isWinner, xp, gold});
    }

    processScoreUpdate({teamId, score}) {
        const team = this.teamsMap.get(teamId);
        team.setScore(score);
        this.emitEvent('overviewChange');
    }

    updateMusicIntensity(ratio){
        this.musicManager.updateMusicIntensity(ratio);
    }

    createSounds() {
        this.SFX = {};
        const sounds = ['click', 'slash', 'steps', 'nope', 'heart', 'cooldown', 'fireball','healing', 'cast', 'thunder', 'ice', 'shatter', 'flames']
        sounds.forEach((sound) => {
            this.SFX[sound] = this.sound.add(sound);
        })
    }

    playSound(name, volume = 1, loop = false) {
        // this.SFX[name].play({volume, loop});

        // const playerPosition = { x: 100, y: 100 };
        // const audioSourcePosition = { x: 300, y: 100 };
        // // Calculate panning (left/right balance) based on positions
        // const pan = 100; // Phaser.Math.Clamp((audioSourcePosition.x - playerPosition.x) / 400, -1, 1);

        this.SFX[name].play({delay: 0, loop});
    }

    stopSound(name) {
        this.SFX[name].stop();
    }

    playSoundMultipleTimes(key, times) {
        if(times <= 0) return;
    
        const sound = this.SFX[key];
    
        sound.once('complete', () => {
            // sound.destroy(); // Destroy the sound instance once done playing
            this.playSoundMultipleTimes(key, times - 1); // Play the sound again
        });
    
        sound.play();
    }


    createAnims() {
        allSprites.forEach((asset) => {
            this.anims.create({
                key: `${asset}_anim_idle`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 9, end: 11 }), 
                frameRate: 5, // Number of frames per second
                repeat: -1,
                yoyo: true 
            });

            this.anims.create({
                key: `${asset}_anim_idle_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 33, end: 35 }), 
                frameRate: 5, // Number of frames per second
                repeat: -1, // Loop indefinitely,
                yoyo: true
            });

            this.anims.create({
                key: `${asset}_anim_walk`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 6, end: 8 }), 
                frameRate: 5, // Number of frames per second
                repeat: -1 // Loop indefinitely
            });

            this.anims.create({
                key: `${asset}_anim_attack`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 12, end: 14 }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_dodge`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 45, end: 47 }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_item`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 48, end: 50 }), 
                frameRate: 5, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 42, end: 44 }), 
                frameRate: 5, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_cast`, 
                frames: this.anims.generateFrameNumbers(asset, { start: 39, end: 41 }), 
                frameRate: 5, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_die`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [51, 52, 53] }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_victory`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [15, 16, 17] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1,
                yoyo: true 
            });

            this.anims.create({
                key: `${asset}_anim_boast`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [15, 16, 17] }), 
                frameRate: 10, // Number of frames per second
                repeat: 2,
                yoyo: true 
            });
        }, this);

        this.anims.create({
            key: `potion_heal`, 
            frames: this.anims.generateFrameNumbers('potion_heal'), 
            frameRate: 10, // Number of frames per second
        });

        this.anims.create({
            key: `explosion_1`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 48, end: 60 }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `explosion_2`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 12, end: 23 }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `explosion_3`, 
            frames: this.anims.generateFrameNumbers('explosions', { start: 0, end: 11 }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `thunder`, 
            frames: this.anims.generateFrameNumbers('thunder', { start: 36, end: 47 }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `ground_flame`, 
            frames: this.anims.generateFrameNumbers('thunder', { start: 48, end: 59 }), 
            frameRate: 15, // Number of frames per second
            repeat: -1
        });

        this.anims.create({
            key: `ice`, 
            frames: this.anims.generateFrameNumbers('ice', { start: 54, end: 67 }), 
            frameRate: 15,
        });

        this.anims.create({
            key: `cast`, 
            frames: this.anims.generateFrameNumbers('cast', { frames: [10, 11, 12] }), 
            frameRate: 15, // Number of frames per second
            repeat: -1
        });

        this.anims.create({
            key: `slash`, 
            frames: this.anims.generateFrameNumbers('slash', { frames: [99, 100, 101, 102] }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `impact`, 
            frames: this.anims.generateFrameNumbers('impact', { start: 0, end: 12 }), 
            frameRate: 25, 
        });

        this.anims.create({
            key: `paralyzed`, 
            frames: this.anims.generateFrameNumbers('statuses', { start: 56, end: 63 }), 
            frameRate: 15,
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

    placeCharacters(data, isPlayer, team: Team) {
        data.forEach((character, i) => {

            let offset;
            if (character.x < this.gridWidth/2) offset = -Math.floor(this.gridWidth/2);
            if (character.x > this.gridWidth/2) offset = Math.floor(this.gridWidth/2);
            const {x, y} = this.gridToPixelCoords(character.x + offset, character.y);

            const player = new Player(
                this, this, this.HUD, team, character.name, character.x, character.y, x, y,
                i + 1, character.frame, isPlayer,
                character.hp, character.mp
                );
            
            if (isPlayer) {
                player.setDistance(character.distance);
                player.setCooldown(character.cooldown);
                player.setInventory(character.inventory);
                player.setSpells(character.spells);
            }

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
        this.setUpArena();
        this.createAnims();
        this.createSounds();
        this.connectToServer();

        this.localAnimationSprite = this.add.sprite(0, 0, '').setScale(LOCAL_ANIMATION_SCALE).setOrigin(0.5, 0.7).setVisible(false);
        this.localAnimationSprite.on('animationcomplete', () => this.localAnimationSprite.setVisible(false), this);

        this.input.mouse.disableContextMenu();

        this.musicManager = new MusicManager(this, 2, 13, [5, 6, 11]);
        this.musicManager.playBeginning();

        this.environmentalAudioSources = {
            flames: 0,
        }
    }

    createHUD() {
        this.scene.launch('HUD'); 
        this.HUD = this.scene.get('HUD');
    }

    displaySpellArea(location, size, delay) {
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

        const duration = 100;
        const repeat = Math.floor((delay * 1000) / (duration * 2)) - 1;
        this.tweens.add({
            targets: spellAreaImage,
            alpha: { from: 1, to: 0.5 }, // From fully visible to invisible
            duration,             // Duration for each blink
            yoyo: true,                // Go back and forth between visible and invisible
            repeat,                 // Number of blinks (or -1 for infinite)
            onComplete: () => {
                spellAreaImage.destroy(); // Destroy the image at the end
            }
        });
    }

    initializeGame(data) {
        console.log(data);
        this.createHUD(); 
        this.playerTeamId = data.player.teamId;

        if(this.playerTeamId === undefined) {
            console.error('Player team id is undefined');
        }

        this.teamsMap.set(data.player.teamId, new Team(this, data.player.teamId, true));
        this.teamsMap.set(data.opponent.teamId, new Team(this, data.opponent.teamId, false));

        this.placeCharacters(data.player.team, true, this.teamsMap.get(data.player.teamId));
        this.placeCharacters(data.opponent.team, false, this.teamsMap.get(data.opponent.teamId));

        if (data.general.reconnect) {
            this.updateOverview();
        } else {
            const delay = 3000;
            setTimeout(this.startAnimation.bind(this), delay);
            setTimeout(this.updateOverview.bind(this), delay + 1000);
        }

        events.on('itemClick', (letter) => {
            this.selectedPlayer?.onLetterKey(letter);
        });
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
     

    updateOverview() {
        this.overviewReady = true;
        this.emitEvent('overviewChange');
    }

    getOverview() {
        const overview =  {
            team1: this.teamsMap.get(1).getOverview(),
            team2: this.teamsMap.get(2).getOverview(),
        };
        return overview;
    }

    killCam(x, y) {
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
            sprite.anims.timeScale = slowMotionScale;
        });

        const firstDelay = 0;
        const secondDelay = firstDelay + 3000;
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
                sprite.anims.timeScale = originalTimeScale;
            });
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
        const flames = this.environmentalAudioSources.flames;
        console.log(`Flames: ${flames}`);
        if (flames > 0) {
            this.playSound('flames', 0.5, true);
        } else {
            this.stopSound('flames');
        }
    }
    

    // update (time, delta)
    // {
    // }
}