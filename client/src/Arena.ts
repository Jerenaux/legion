
import { io } from 'socket.io-client';
import { Player } from './Player';
import { Server } from './Server';
export class Arena extends Phaser.Scene
{
    socket;
    HUD;
    localPlayer;
    gridCorners;
    gridMap: Map<string, Player> = new Map<string, Player>();
    playersMap: Map<number, Player> = new Map<number, Player>();
    opponentsMap: Map<number, Player> = new Map<number, Player>();
    selectedPlayer: Player | null = null;
    highlight: Phaser.GameObjects.Graphics;
    tileSize = 60;
    gridWidth = 20;
    gridHeight = 9;
    server;

    constructor() {
        super({ key: 'Arena' });
    }

    preload ()
    {
        this.load.image('bg',  '/assets/aarena_bg.png');
        // this.load.svg('pop', 'assets/pop.svg',  { width: 24, height: 24 } );
        const frameConfig = { frameWidth: 144, frameHeight: 144};
        this.load.spritesheet('warrior_1', 'assets/sprites/1_1.png', frameConfig);
        this.load.spritesheet('warrior_2', 'assets/sprites/1_2.png', frameConfig);
        this.load.spritesheet('warrior_3', 'assets/sprites/1_3.png', frameConfig);
        this.load.spritesheet('warrior_4', 'assets/sprites/1_4.png', frameConfig);
        this.load.spritesheet('mage_1', 'assets/sprites/1_5.png', frameConfig);
        this.load.spritesheet('mage_2', 'assets/sprites/1_6.png', frameConfig);
        // this.load.audio('click', 'assets/click_2.wav');
    }


    connectToServer() {
        // this.socket = io('http://localhost:3123');

        // this.socket.on('connect', () => {
        //     console.log('Connected to the server');
        // });
        
        // this.socket.on('disconnect', () => {
        //     console.log('Disconnected from the server');
        // }); 

        // this.socket.on('init', this.initializeGame.bind(this));
        this.server = new Server();
        
        this.initializeGame(this.server.getPlacementData());

        // this.socket.on('addCity', (data) => {
        //     // console.log('addCity data received from the server');
        //     this.addCity(data.tile, data.player);
        // });
    }

    sendMove(x, y) {
        const data = {
            tile: { x, y},
            num: this.selectedPlayer.num,
        };
        // this.send('move', data);
        const serverData = this.server.processMove(data);
        this.processMove(serverData);
    }

    sendAttack(player: Player) {
        const data = {
            num: this.selectedPlayer.num,
            target: player.num,
        };
        // this.send('attack', data);
        const serverData = {
            isPlayer: true,
            target: player.num,
            num: this.selectedPlayer.num,
        };
        this.processAttack(serverData);
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

    drawGrid() {
        const totalWidth = this.tileSize * this.gridWidth;
        const totalHeight = this.tileSize * this.gridHeight;

        // const gameWidth = Number(this.sys.game.config.width);
        // const gameHeight = Number(this.sys.game.config.height);
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + 150;

        // Create a graphics object
        let graphics = this.add.graphics().setDepth(2).setAlpha(0.5);

        // Loop over each row
        for (let y = 0; y < this.gridHeight; y++) {
            // In each row, loop over each column
            for (let x = 0; x < this.gridWidth; x++) {
                
                if (this.isSkip(x, y)) continue;
                // Set the fill style to transparent
                graphics.fillStyle(0xffffff, 0);
                graphics.fillRect(startX + x * this.tileSize, startY + y * this.tileSize, this.tileSize, this.tileSize);
                
                // Set the line style to white for the border
                graphics.lineStyle(2, 0xffffff, 1);
                graphics.strokeRect(startX + x * this.tileSize, startY + y * this.tileSize, this.tileSize, this.tileSize);
            }
        }

        this.gridCorners = {
            startX: startX,
            startY: startY,
        };

         // Create a separate graphics object for the highlight
         let highlightGraphics = this.add.graphics().setDepth(1);

         // Add a pointer move handler to highlight the hovered tile
         this.input.on('pointermove', function (pointer) {
             let pointerX = pointer.x - startX;
             let pointerY = pointer.y - startY;
 
             // Calculate the grid coordinates of the pointer
             let gridX = Math.floor(pointerX / this.tileSize);
             let gridY = Math.floor(pointerY / this.tileSize);
            //  console.log(gridX, gridY);
 
             // Ensure the pointer is within the grid
             if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                 // Clear the previous highlight
                 highlightGraphics.clear();

                 if (this.isSkip(gridX, gridY)) return;
 
                 // Draw a new highlight over the hovered tile
                 highlightGraphics.fillStyle(0xffffff, 0.3); // Semi-transparent white
                 highlightGraphics.fillRect(startX + gridX * this.tileSize, startY + gridY * this.tileSize, this.tileSize, this.tileSize);
             } else {
                 // Clear the highlight if the pointer is outside the grid
                 highlightGraphics.clear();
             }
         }, this);

         // Add a pointer down handler to print the clicked tile coordinates
        this.input.on('pointerdown', function (pointer) {
            let pointerX = pointer.x - startX;
            let pointerY = pointer.y - startY;

            // Calculate the grid coordinates of the pointer
            let gridX = Math.floor(pointerX / this.tileSize);
            let gridY = Math.floor(pointerY / this.tileSize);

            if (this.isSkip(gridX, gridY)) return;

            // Ensure the pointer is within the grid
            if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                this.handleTileClick(gridX, gridY);
            }
        }, this);

        const bg = this.add.image(0, -230, 'bg').setOrigin(0, 0);

        let scaleX = gameWidth / bg.width;
        let scaleY = gameHeight / bg.height;
        let scale = Math.max(scaleX, scaleY);
        bg.setScale(scale).setAlpha(0.7);

        this.input.keyboard.on('keydown', this.handleKeyDown, this);
    }

    handleKeyDown(event) {
        // Check if the pressed key is a number
        let number;
        if (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NINE) {
            // Convert the key code to a number
            number = event.keyCode - Phaser.Input.Keyboard.KeyCodes.ZERO;
        } else if (event.keyCode >= Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO && event.keyCode <= Phaser.Input.Keyboard.KeyCodes.NUMPAD_NINE) {
            // Convert the key code to a number (for numpad keys)
            number = event.keyCode - Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO;
        } else {
            return;
        }
        this.handlePlayerSelect(this.playersMap[number]);
    }

    isFree(gridX, gridY) {
        const isFree = !this.gridMap[this.serializeCoords(gridX, gridY)];
        return isFree;
    }

    handleTileClick(gridX, gridY) {
        console.log(`Clicked tile at grid coordinates (${gridX}, ${gridY})`);
        const player = this.gridMap[this.serializeCoords(gridX, gridY)];
        if (this.selectedPlayer && !player) {
            this.handleMove(gridX, gridY);
        } else {
            this.handlePlayerSelect(player);
        }
    }

    handleMove(gridX, gridY) {
        if (!this.selectedPlayer.canMoveTo(gridX, gridY)) return;
        if (!this.isFree(gridX, gridY)) return;
        this.sendMove(gridX, gridY);
        this.deselectPlayer();
    }

    deselectPlayer() {
        if (this.selectedPlayer) {
            this.selectedPlayer.toggleSelect();
            this.selectedPlayer = null;
            this.clearHighlight();
        }
    }

    handlePlayerSelect(player: Player) {
        if (!player || !player.isPlayer) return;
        if (this.selectedPlayer === player) {
            this.deselectPlayer();
            return;
        }
        if (this.selectedPlayer) this.selectedPlayer.toggleSelect();
        this.selectedPlayer = player;
        this.selectedPlayer.toggleSelect();
    }

    getPlayer(isPlayer, num) {
        return isPlayer ? this.playersMap[num] : this.opponentsMap[num];
    }

    processMove({isPlayer, tile, num}) {
        const player = this.getPlayer(isPlayer, num);
        const {x, y} = this.gridToPixelCoords(tile.x, tile.y);

        this.gridMap[this.serializeCoords(player.gridX, player.gridY)] = null;
        this.gridMap[this.serializeCoords(tile.x, tile.y)] = player;

        player.walkTo(tile.x, tile.y, x, y);
    }

    processAttack({isPlayer, target, num}) {
        const player = this.getPlayer(isPlayer, num);
        const targetPlayer = this.getPlayer(!isPlayer, target);
        player.attack(targetPlayer);
    }

    createAnims() {
        const assets = ['warrior_1', 'warrior_2', 'warrior_3', 'warrior_4', 'mage_1', 'mage_2']
        // Loop over assets
        assets.forEach((asset) => {
            this.anims.create({
                key: `${asset}_anim_idle`, // The name of the animation
                frames: this.anims.generateFrameNumbers(asset, { frames: [9, 10, 11] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1 // Loop indefinitely
            });

            this.anims.create({
                key: `${asset}_anim_walk`, // The name of the animation
                frames: this.anims.generateFrameNumbers(asset, { frames: [6, 7, 8] }), 
                frameRate: 5, // Number of frames per second
                repeat: -1 // Loop indefinitely
            });

            this.anims.create({
                key: `${asset}_anim_attack`, // The name of the animation
                frames: this.anims.generateFrameNumbers(asset, { frames: [12, 13, 14] }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_dodge`, // The name of the animation
                frames: this.anims.generateFrameNumbers(asset, { frames: [45, 46, 47] }), 
                frameRate: 10, // Number of frames per second
            });

            this.anims.create({
                key: `${asset}_anim_hurt`, // The name of the animation
                frames: this.anims.generateFrameNumbers(asset, { frames: [36, 37, 38] }), 
                frameRate: 10, // Number of frames per second
            });
        }, this);
    }

    gridToPixelCoords(gridX, gridY) {
        return {
            x: gridX * this.tileSize + this.gridCorners.startX + 30,
            y: gridY * this.tileSize + this.gridCorners.startY - 10,
        };
    }

    placeCharacters(data, isPlayer) {
        data.forEach((character, i) => {
            const {x, y} = this.gridToPixelCoords(character.x, character.y);

            const player = new Player(this, character.x, character.y, x, y, i + 1, character.frame, isPlayer);
            player.setDistance(character.distance);
            this.gridMap[this.serializeCoords(character.x, character.y)] = player;

            if (isPlayer) {
                this.playersMap[i + 1] = player;
            } else {
                this.opponentsMap[i + 1] = player;
            }
        }, this);
    }

    serializeCoords(x, y) {
        return `${x},${y}`;
    }

    highlightCells(gridX, gridY, radius) {
        // Create a new Graphics object to highlight the cells
        if (!this.highlight) this.highlight = this.add.graphics();
        this.clearHighlight();
        this.highlight.fillStyle(0xffd700, 0.7); // Use golden color
    
        // Iterate over each cell in the grid
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                // Check if the cell is within the circle
                if (x * x + y * y <= radius * radius) {
                    if (this.isSkip(gridX + x, gridY + y) || !this.isFree(gridX + x, gridY + y)) continue;
                    // Calculate the screen position of the cell
                    let posX = this.gridCorners.startX + (gridX + x) * this.tileSize;
                    let posY = this.gridCorners.startY + (gridY + y) * this.tileSize;
    
                    // Draw a rectangle around the cell
                    this.highlight.fillRect(posX, posY, this.tileSize, this.tileSize);
                }
            }
        }
    }

    clearHighlight() {
        if (this.highlight) this.highlight.clear();
    }
    
    create ()
    {
        this.drawGrid();
        this.createAnims();
        this.connectToServer();
    }

    createHUD() {
        this.scene.launch('HUD'); 
        this.HUD = this.scene.get('HUD');
    }

    initializeGame(data) {
        this.createHUD(); 
        this.placeCharacters(data.player.team, true);
        this.placeCharacters(data.opponent.team, false);
    }

  
    update (time, delta)
    {
    }
}