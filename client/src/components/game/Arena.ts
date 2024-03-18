
import { io } from 'socket.io-client';
import { Player } from './Player';
import { GameHUD, events } from './HUD/GameHUD';
import { Team } from './Team';
import { MusicManager } from './MusicManager';
import { CellsHighlight } from './CellsHighlight';
import { spells } from '@legion/shared/Spells';
import { lineOfSight, serializeCoords } from '@legion/shared/utils';
import { getFirebaseIdToken } from '../../services/apiService';
import { allSprites } from '@legion/shared/sprites';

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
    gridWidth = 20;
    gridHeight = 9;
    server;
    animationScales;
    SFX;
    overviewReady = false;
    musicManager: MusicManager;

    constructor() {
        super({ key: 'Arena' });
    }

    preload ()
    {
        this.gamehud = new GameHUD();
        
        this.load.image('bg',  'aarena_bg.png');
        this.load.image('killzone',  'killzone.png');
        this.load.image('spark',  'spark.png');
        // this.load.svg('pop', 'pop.svg',  { width: 24, height: 24 } );
        const frameConfig = { frameWidth: 144, frameHeight: 144};
        // Iterate over assetsMap and load spritesheets
        allSprites.forEach((sprite) => {
            this.load.spritesheet(sprite, `sprites/${sprite}.png`, frameConfig);
        });
        this.load.spritesheet('potion_heal', 'animations/potion_heal.png', { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('explosion', 'animations/explosion.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('cast', 'animations/cast.png', { frameWidth: 48, frameHeight: 64});
        this.load.spritesheet('slash', 'animations/slash.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('thunder', 'animations/bolts.png', { frameWidth: 96, frameHeight: 96});
        this.load.spritesheet('ice', 'animations/ice.png', { frameWidth: 96, frameHeight: 96});


        this.load.audio('click', 'sfx/click_2.wav');
        this.load.audio('slash', 'sfx/swish_2.wav');
        this.load.audio('steps', 'sfx/steps.wav');
        this.load.audio('nope', 'sfx/nope.wav');
        this.load.audio('heart', 'sfx/heart.wav');
        this.load.audio('cooldown', 'sfx/cooldown.wav');
        this.load.audio('healing', 'sfx/healing.wav');
        this.load.audio('cast', 'sfx/curse.ogg');

        this.load.audio('fireball', 'sfx/fireball.wav');
        this.load.audio('thunder', 'sfx/thunder.wav');
        this.load.audio('ice', 'sfx/ice.wav');

        this.load.audio(`bgm_start`, `music/bgm_start.wav`);
        for (let i = 2; i <= 13; i++) {
            this.load.audio(`bgm_loop_${i}`, `music/bgm_loop_${i}.wav`);
        }
        this.load.audio(`bgm_end`, `music/bgm_end.wav`);

        this.load.atlas('groundTiles', 'tiles.png', 'tiles.json');

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

        this.socket.on('gameStart', this.initializeGame.bind(this));

        this.socket.on('move', (data) => {
            this.processMove(data);
        });

        this.socket.on('attack', (data) => {
            this.processAttack(data);
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

    sendSkill(x: number, y: number) {
        if (!this.selectedPlayer || !this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            x,
            y,
            index: this.selectedPlayer.pendingSkill,
        };
        this.send('skill', data);
        this.toggleTargetMode(false);
        this.selectedPlayer.pendingSkill = null;
    }

    sendUseItem(index: number, x: number, y: number) {
        if (!this.selectedPlayer.canAct()) return;
        const data = {
            num: this.selectedPlayer.num,
            x,
            y,
            index
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
        // this.localAnimationSprite = this.add.sprite(0, 0, '').setScale(3).setOrigin(0.5, 0.7).setVisible(false);

        // Loop over each row
        for (let y = 0; y < this.gridHeight; y++) {
            // In each row, loop over each column
            for (let x = 0; x < this.gridWidth; x++) {
                
                if (this.isSkip(x, y)) continue;
                this.floatOneTile(x, y, startX, startY);
            }
        }

        for (let x = -5; x < 0; x++) {
            for (let y = 2; y < 7; y++) {
                this.floatOneTile(x, y, startX, startY);
            }
        }

        for (let x = 20; x < 26; x++) {
            for (let y = 2; y < 7; y++) {
                this.floatOneTile(x, y, startX, startY);
            }
        }
    }

    floatOneTile(x, y, startX, startY) {
        const tileWeights = {
            53: 15,
            54: 2,
            52: 2,
            51: 2,
            50: 1,
            49: 1,
            48: 1,
            47: 1,
            46: 1,
        };
        const tiles = [];
        for (const tile in tileWeights) {
            for (let i = 0; i < tileWeights[tile]; i++) {
                tiles.push(parseInt(tile));
            }
        }

        const tile = tiles[Math.floor(Math.random() * tiles.length)];
        const tileSprite = this.add.image(startX + x * this.tileSize, startY + y * this.tileSize + this.scale.gameSize.height, 'groundTiles', `element_${tile}`)
            .setDisplaySize(this.tileSize, this.tileSize)
            .setDepth(1)
            .setOrigin(0); 
        
        // Add a random vertical and/or horizontal flip
        const flipX = Math.random() < 0.5;
        const flipY = Math.random() < 0.5;
        tileSprite.setFlip(flipX, flipY);

        // Tween the tile to its intended position
        this.tweens.add({
            targets: tileSprite,
            y: startY + y * this.tileSize,
            duration: 1000, // duration of the tween in milliseconds
            ease: 'Power2', // easing function to make the movement smooth
            delay: Math.random() * 500 // random delay to make the tiles fall at different times
        });

        // After the initial tween, add another tween to give a floating effect
        // this.tweens.add({
        //     targets: tileSprite,
        //     y: startY + y * this.tileSize + 10,
        //     duration: 1000, // duration of the tween in milliseconds
        //     ease: 'Power1', // easing function to make the movement smooth
        //     repeat: -1, // repeat the tween indefinitely
        //     yoyo: true, // reverse the tween at the end
        //     delay: 2000 // wait 1 second before starting the tween
        // });
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

        const bg = this.add.image(0, -230, 'bg').setOrigin(0, 0);

        const scaleX = gameWidth / bg.width;
        const scaleY = gameHeight / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale).setAlpha(0.7);

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
            this.teamsMap.get(this.playerTeamId).getMember(number)?.onClick();
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
        const isFree = !this.gridMap[serializeCoords(gridX, gridY)];
        return isFree;
    }

    handleTileClick(gridX, gridY) {
        console.log(`Clicked tile at grid coordinates (${gridX}, ${gridY})`);
        const player = this.gridMap[serializeCoords(gridX, gridY)];
        if (this.selectedPlayer?.pendingSkill != null) {
            this.sendSkill(gridX, gridY);
        } else if (this.selectedPlayer?.pendingItem != null) {
            this.sendUseItem(this.selectedPlayer?.pendingItem, gridX, gridY);
        } else if (this.selectedPlayer && !player) {
            this.handleMove(gridX, gridY);
        } else if (player){ 
            player.onClick();
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

        this.gridMap[serializeCoords(player.gridX, player.gridY)] = null;
        this.gridMap[serializeCoords(tile.x, tile.y)] = player;

        player.walkTo(tile.x, tile.y);
        this.playSoundMultipleTimes('steps', 2);
    }

    processAttack({team, target, num, damage, hp}) {
        const player = this.getPlayer(team, num);
        const otherTeam = this.getOtherTeam(team);
        const targetPlayer = this.getPlayer(otherTeam, target);
        this.playSound('slash');
        player.attack(targetPlayer);
        targetPlayer.setHP(hp);
        targetPlayer.displayDamage(damage);
        targetPlayer.displaySlash(player);
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
        const spell = spells[id];
        player.castAnimation(flag, spell?.name);
        if (flag) this.displaySpellArea(location, spell.size, spell.castTime);
    }

    processTerrain({x, y, size, type}) {
        // Iterate over x - floor(size/2) to x + floor(size/2) and y - floor(size/2) to y + floor(size/2)
        for (let i = x - Math.floor(size/2); i <= x + Math.floor(size/2); i++) {
            for (let j = y - Math.floor(size/2); j <= y + Math.floor(size/2); j++) {
                const {x: pixelX, y: pixelY} = this.gridToPixelCoords(i, j);
                const sprite = this.add.sprite(pixelX, pixelY, 'groundTiles', `element_${type}`)
                    .setDepth(5).setScale(2).setAlpha(0.9);
                sprite.anims.play('ground_flame');
            }
        }
    
    }

    processLocalAnimation({x, y, id}) {
        // Convert x and y in grid coords to pixels
        const {x: pixelX, y: pixelYInitial} = this.gridToPixelCoords(x, y);
        const spell = spells[id];
        let pixelY = pixelYInitial;
        if (spell.yoffset) pixelY += spell.yoffset;
        this.localAnimationSprite.setPosition(pixelX, pixelY)
            .setVisible(true)
            .setDepth(3.5 + y/10)
            .play(spell.animation);
        this.playSound(spell.sfx);
        if (spell.shake) this.cameras.main.shake(250, 0.01); // More intense shake
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
        const sounds = ['click', 'slash', 'steps', 'nope', 'heart', 'cooldown', 'fireball','healing', 'cast', 'thunder', 'ice']
        sounds.forEach((sound) => {
            this.SFX[sound] = this.sound.add(sound);
        })
    }

    playSound(name, volume = 1, loop = false) {
        // this.SFX[name].play({volume, loop});
        this.SFX[name].play({delay: 0});
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
                frames: this.anims.generateFrameNumbers(asset, { frames: [9, 10, 11] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1,
                yoyo: true 
            });

            this.anims.create({
                key: `${asset}_anim_idle_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [33, 34, 35] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1, // Loop indefinitely,
                yoyo: true
            });

            this.anims.create({
                key: `${asset}_anim_walk`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [6, 7, 8] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1 // Loop indefinitely
            });

            this.anims.create({
                key: `${asset}_anim_attack`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [12, 13, 14] }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_dodge`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [45, 46, 47] }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_item`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [48, 49, 50] }), 
                frameRate: 5, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_hurt`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [42, 43, 44] }), 
                frameRate: 5, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_cast`, 
                frames: this.anims.generateFrameNumbers(asset, { frames: [39, 40, 41] }), 
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
            key: `explosion`, 
            frames: this.anims.generateFrameNumbers('explosion', { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `thunder`, 
            frames: this.anims.generateFrameNumbers('thunder', { frames: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47] }), 
            frameRate: 15, // Number of frames per second
        });

        this.anims.create({
            key: `ground_flame`, 
            frames: this.anims.generateFrameNumbers('thunder', { frames: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59] }), 
            frameRate: 15, // Number of frames per second
            repeat: -1
        });

        this.anims.create({
            key: `ice`, 
            frames: this.anims.generateFrameNumbers('ice', { frames: [54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 64, 66, 67] }), 
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
            // if (isPlayer) console.log(character);

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

            this.gridMap[serializeCoords(character.x, character.y)] = player;

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

        this.localAnimationSprite = this.add.sprite(0, 0, '').setScale(3).setOrigin(0.5, 0.7).setVisible(false);
        this.localAnimationSprite.on('animationcomplete', () => this.localAnimationSprite.setVisible(false), this);

        this.input.mouse.disableContextMenu();

        this.musicManager = new MusicManager(this, 2, 13, [5, 6]);
        this.musicManager.playBeginning();

    }

    createHUD() {
        this.scene.launch('HUD'); 
        this.HUD = this.scene.get('HUD');
    }

    displaySpellArea(location, size, delay) {
        const {x, y} = this.gridToPixelCoords(location.x, location.y);
        const spellAreaImage = this.add.image(x + 2, y + 42, 'killzone')
            .setDepth(1)
            .setDisplaySize(size * this.tileSize, size * this.tileSize)
            .setOrigin(0.5); // This will tint the sprite red

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

        setTimeout(this.updateOverview.bind(this), 2000);

        events.on('itemClick', (letter) => {
            this.selectedPlayer?.onLetterKey(letter);
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

    // update (time, delta)
    // {
    // }
}