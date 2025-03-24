import { lineOfSight, serializeCoords, isSkip, getTilesInHexRadius } from '@legion/shared/utils';
import { GRID_WIDTH, GRID_HEIGHT } from '@legion/shared/config';
import { Player } from './Player';

// Add tile color constants
export enum TileColors {
    NORMAL = 0xffffff,
    HOVER = 0x00ff00,
    PLAYER_TEAM = 0x000080, // Dark blue
    ENEMY_TEAM = 0x800000,  // Dark red
    MOVEMENT_RANGE = 0x00ffff, // Cyan
    TARGET_RANGE = 0xffaaaa, // Light red
    SPELL_RADIUS = 0xff0000, // Bright red
    TARGET_ALLY = 0x00cc00,  // Green for allies in target range
    TARGET_ENEMY = 0xff3333, // Red for enemies in target range
    DARKENED = 0x666666     // Darkened tiles
}

// Define the highlight types with their priorities
export enum HighlightType {
    BASE = 0,        // Base tile color (lowest priority)
    MOVEMENT = 10,   // Movement range
    TARGET = 20,     // Target range
    HOVER = 25,     // Hover
    SPELL = 30,      // Spell effect area
}

export class HexGridManager {
    // Constants for hex dimensions
    public static readonly HEX_WIDTH = 87; // Width of hexagon
    public static readonly HEX_HEIGHT = 100; // Height of hexagon
    public static readonly PERSPECTIVE_SCALE = 0.8;
    private static readonly HEX_HORIZ_SPACING = HexGridManager.HEX_WIDTH;
    private static readonly HEX_VERT_SPACING = HexGridManager.HEX_HEIGHT * 0.75 * HexGridManager.PERSPECTIVE_SCALE;

    // References to game objects and maps
    private scene: Phaser.Scene;
    private tilesMap: Map<string, Phaser.GameObjects.Image> = new Map<string, Phaser.GameObjects.Image>();
    private obstaclesMap: Map<string, boolean> = new Map<string, boolean>();
    private coordinateTexts: Map<string, Phaser.GameObjects.Text> = new Map<string, Phaser.GameObjects.Text>();
    private showCoordinates: boolean = false;
    private isDarkened: boolean = false;
    private tileStates: Map<string, { 
        baseColor: number, 
        highlights: Map<HighlightType, number> 
    }> = new Map();
    
    // Grid dimensions and position
    private gridCorners: { startX: number, startY: number };

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.calculateGridCorners();
    }

    private calculateGridCorners() {
        const totalWidth = HexGridManager.HEX_WIDTH * GRID_WIDTH;
        const totalHeight = HexGridManager.HEX_HEIGHT * GRID_HEIGHT;
        const gameWidth = this.scene.scale.gameSize.width;
        const gameHeight = this.scene.scale.gameSize.height;
        const verticalOffset = 200;
        const startX = (gameWidth - totalWidth) / 2;
        const startY = (gameHeight - totalHeight) / 2 + verticalOffset;

        this.gridCorners = { startX, startY };
    }

    // Convert hex grid coordinates to pixel coordinates
    hexGridToPixelCoords(gridX: number, gridY: number) {
        const centerTileYOffset = 40;
        const { startX, startY } = this.gridCorners;
        const offsetX = startX + HexGridManager.HEX_WIDTH / 2;
        const offsetY = startY + HexGridManager.HEX_HEIGHT / 2;
        
        // Calculate row offset (even rows are shifted right)
        const rowOffset = (gridY % 2 === 0) ? HexGridManager.HEX_WIDTH / 2 : 0;
        
        return {
            x: offsetX + gridX * HexGridManager.HEX_HORIZ_SPACING + rowOffset,
            y: offsetY + gridY * HexGridManager.HEX_VERT_SPACING - centerTileYOffset
        };
    }

    // Convert pixel coordinates to hex grid coordinates
    pointerToHexGrid(pointer: Phaser.Input.Pointer) {
        const { startX, startY } = this.gridCorners;
        const offsetX = startX + HexGridManager.HEX_WIDTH / 2;
        const offsetY = 0;
        
        const pointerX = pointer.x + this.scene.cameras.main.scrollX - startX;
        const pointerY = pointer.y + this.scene.cameras.main.scrollY - startY;
        
        // Estimate the row first based on Y position
        const estimatedRow = Math.floor((pointerY - offsetY) / HexGridManager.HEX_VERT_SPACING);
        
        // Determine the column offset for this row
        const rowOffset = (estimatedRow % 2 === 0) ? HexGridManager.HEX_WIDTH / 2 : 0;
        
        // Estimate the column based on X position and row offset
        const estimatedCol = Math.floor((pointerX - rowOffset) / HexGridManager.HEX_HORIZ_SPACING);
        
        return { gridX: estimatedCol, gridY: estimatedRow };
    }

    // Create the hex grid tiles with proper animation
    floatHexTiles(duration: number, onTileClickHandler: (x: number, y: number) => void, onTileHoverHandler: (x: number, y: number, hover?: boolean) => void) {
        const { startX, startY } = this.gridCorners;
        const offsetX = startX + HexGridManager.HEX_WIDTH / 2;
        const offsetY = startY + HexGridManager.HEX_HEIGHT / 2;
        
        // Loop over each row
        for (let y = 0; y < GRID_HEIGHT; y++) {
            // Calculate row offset (even rows are shifted right)
            const rowOffset = (y % 2 === 0) ? (HexGridManager.HEX_WIDTH / 2) : 0;
            
            // In each row, loop over each column
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (isSkip(x, y)) continue;
                
                // Calculate hex position
                const hexX = offsetX + x * HexGridManager.HEX_HORIZ_SPACING + rowOffset;
                const hexY = offsetY + y * HexGridManager.HEX_VERT_SPACING;
                
                this.floatOneHexTile(x, y, hexX, hexY, duration, onTileClickHandler, onTileHoverHandler);
            }
        }
    }

    // Note: This method is primarily used for initialization
    // For regular character movement, use updateTileOnCharacterExit and updateTileOnCharacterEnter instead.
    setCharacterTiles(gridMap: Map<string, Player>) {
        // Reset tile base colors
        this.tileStates.forEach((state, key) => {
            state.baseColor = TileColors.NORMAL;
        });
        
        // Update colors based on gridMap
        gridMap.forEach((player, key) => {
            const color = player.isPlayer ? TileColors.PLAYER_TEAM : TileColors.ENEMY_TEAM;
            
            if (!this.tileStates.has(key)) {
                this.tileStates.set(key, { 
                    baseColor: color, 
                    highlights: new Map() 
                });
            } else {
                this.tileStates.get(key).baseColor = color;
            }
        });
        
        // Update all tile colors
        this.refreshTileColors();
    }

    // Refresh all tile colors based on their current states
    private refreshTileColors() {
        this.tilesMap.forEach((tile, key) => {
            if (this.tileStates.has(key)) {
                this.applyHighestPriorityHighlight(tile, key);
            } else {
                this.applyTileColor(tile, TileColors.NORMAL);
            }
        });
    }

    // Apply color to a tile considering darkened state
    private applyTileColor(tile: Phaser.GameObjects.Image, color: number) {
        if (this.isDarkened) {
            // Update the list of colors that shouldn't be darkened
            const isDarkenable = 
                color !== TileColors.SPELL_RADIUS && 
                color !== TileColors.TARGET_ALLY && 
                color !== TileColors.TARGET_ENEMY &&
                color !== TileColors.HOVER &&
                color !== TileColors.PLAYER_TEAM &&  // Add player team color
                color !== TileColors.ENEMY_TEAM;     // Add enemy team color
                
            if (isDarkenable) {
                // @ts-ignore
                tile.previousTint = color; // Store the intended color
                tile.setTint(TileColors.DARKENED);
            } else {
                tile.setTint(color);
            }
        } else {
            tile.setTint(color);
        }
    }

    // Apply a highlight with a specific type (priority)
    applyHighlight(gridX: number, gridY: number, color: number, type: HighlightType) {
        const key = serializeCoords(gridX, gridY);
        const tile = this.getTile(gridX, gridY);
        
        if (tile) {
            // Initialize tile state if needed
            if (!this.tileStates.has(key)) {
                this.tileStates.set(key, { 
                    baseColor: TileColors.NORMAL, 
                    highlights: new Map()
                });
            }
            
            // Add this highlight type
            this.tileStates.get(key).highlights.set(type, color);
            
            // Apply the highest priority highlight
            this.applyHighestPriorityHighlight(tile, key);
        }
    }

    // Remove a specific highlight type
    removeHighlight(gridX: number, gridY: number, type: HighlightType) {
        const key = serializeCoords(gridX, gridY);
        const tile = this.getTile(gridX, gridY);
        
        if (tile && this.tileStates.has(key)) {
            // Remove this highlight type
            this.tileStates.get(key).highlights.delete(type);
            
            // Apply the next highest priority highlight
            this.applyHighestPriorityHighlight(tile, key);
        }
    }

    // Apply the highest priority highlight to a tile
    private applyHighestPriorityHighlight(tile: Phaser.GameObjects.Image, key: string) {
        const state = this.tileStates.get(key);
        
        if (!state) return;
        
        // Find the highest priority highlight
        let highestPriority = HighlightType.BASE;
        let highestColor = state.baseColor;
        
        state.highlights.forEach((color, type) => {
            if (type > highestPriority) {
                highestPriority = type;
                highestColor = color;
            }
        });
        
        // Apply the highest priority color
        this.applyTileColor(tile, highestColor);
    }

    // Now update the onTileHover method to use this system
    private onTileHover(gridX: number, gridY: number, hover: boolean) {
        // Check if tile in target mode
        const isInTargetMode = this.tileStates.get(serializeCoords(gridX, gridY))?.highlights.has(HighlightType.TARGET);
        if (isInTargetMode) return;
        if (hover) {
            this.applyHighlight(gridX, gridY, TileColors.HOVER, HighlightType.HOVER);
        } else {
            this.removeHighlight(gridX, gridY, HighlightType.HOVER);
        }
    }

    // Create a single hex tile with animation and interactivity
    private floatOneHexTile(
        x: number, 
        y: number, 
        hexX: number, 
        hexY: number, 
        duration: number,
        arenaTileClickHandler: (x: number, y: number) => void,
        arenaTileHoverHandler: (x: number, y: number, hover?: boolean) => void
    ) {
        // Create tile
        const tileSprite = this.scene.add.image(
            hexX, 
            hexY,
            'hexTile'
        )
        .setDepth(1)
        .setOrigin(0.5, 0.5)
        .setAlpha(0.5)
        .setScale(1, HexGridManager.PERSPECTIVE_SCALE);

        // Make tile interactive
        tileSprite.setInteractive();
        
        // Set up event handlers
        tileSprite.on('pointerover', () => {
            if (isSkip(x, y)) return;
            this.onTileHover(x, y, true);
            arenaTileHoverHandler(x, y, true);
        });

        tileSprite.on('pointerout', () => {
            if (isSkip(x, y)) return;
            this.onTileHover(x, y, false);
            arenaTileHoverHandler(x, y, false);
        });

        tileSprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) return;
            arenaTileClickHandler(x, y);
        });

        // Store tile reference in the map
        this.tilesMap.set(serializeCoords(x, y), tileSprite);

        // Initialize tile state
        this.tileStates.set(
            serializeCoords(x, y), 
            { 
                baseColor: TileColors.NORMAL, 
                highlights: new Map() 
            }
        );
        
        // Create coordinate text
        const coordText = this.scene.add.text(
            hexX, 
            hexY, 
            `${x},${y}`,
            { 
                fontFamily: 'Arial', 
                fontSize: '16px',
                color: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 3
            }
        )
        .setDepth(10)
        .setOrigin(0.5, 0.5)
        .setVisible(this.showCoordinates);
        
        // Store coordinate text reference
        this.coordinateTexts.set(serializeCoords(x, y), coordText);
        
        return tileSprite;
    }

    // Validation methods
    isValidGridPosition(x: number, y: number): boolean {
        return x >= 0 && x < GRID_WIDTH && 
               y >= 0 && y < GRID_HEIGHT && 
               !isSkip(x, y);
    }

    isValidCell(fromX: number, fromY: number, toX: number, toY: number, isFree: (x: number, y: number) => boolean) {
        return this.isValidGridPosition(toX, toY) 
            && isFree(toX, toY)
            && lineOfSight(fromX, fromY, toX, toY, isFree);
    }

    // Highlight method for tiles in a radius
    highlightTilesInRadius(gridX: number, gridY: number, radius: number, color: number = TileColors.MOVEMENT_RANGE, shouldHighlight?: (x: number, y: number) => boolean, type: HighlightType = HighlightType.MOVEMENT) {
        const tilesInRadius = this.getTilesInRadius(gridX, gridY, radius);
        
        for (const tile of tilesInRadius) {
            if (!this.isValidGridPosition(tile.x, tile.y)) continue;
            
            if (shouldHighlight && !shouldHighlight(tile.x, tile.y)) continue;
            
            this.applyHighlight(tile.x, tile.y, color, type);
        }
    }

    // Highlight target range (current position + 2)
    highlightTargetRange(gridX: number, gridY: number, radius: number) {
        this.highlightTilesInRadius(gridX, gridY, radius + 2, TileColors.TARGET_RANGE);
    }

    // Highlight spell effects and add glow to characters
    highlightSpellRadius(gridX: number, gridY: number, radius: number, gridMap: Map<string, Player>, isAllyCallback: (player: Player) => boolean) {
        const tilesInRadius = this.getTilesInRadius(gridX, gridY, radius);
        
        for (const tile of tilesInRadius) {
            if (!this.isValidGridPosition(tile.x, tile.y)) continue;
            
            const key = serializeCoords(tile.x, tile.y);
            const tileSprite = this.tilesMap.get(key);
            
            if (tileSprite) {
                // Apply spell radius color using the highlight system
                this.applyHighlight(tile.x, tile.y, TileColors.SPELL_RADIUS, HighlightType.SPELL);
                
                // If there's a character on this tile, make it glow
                const player = gridMap.get(key);
                if (player) {
                    const isAlly = isAllyCallback(player);
                    // Signal Arena to make the character glow
                    const event = new CustomEvent('characterInSpellRadius', {
                        detail: {
                            x: tile.x,
                            y: tile.y,
                            isAlly
                        }
                    });
                    window.dispatchEvent(event);
                }
            }
        }
    }

    // Clear all highlighted tiles of a specific type
    clearHighlightOfType(type: HighlightType) {
        this.tilesMap.forEach((tile, key) => {
            const gridPos = key.split(',').map(Number);
            this.removeHighlight(gridPos[0], gridPos[1], type);
        });
    }

    // Clear all highlighted tiles
    clearHighlight() {
        // Clear all highlight types except BASE
        this.tilesMap.forEach((tile, key) => {
            if (this.tileStates.has(key)) {
                const state = this.tileStates.get(key);
                state.highlights.clear();
                this.applyTileColor(tile, state.baseColor);
            } else {
                this.applyTileColor(tile, TileColors.NORMAL);
            }
        });
    }

    // Toggle coordinate display
    toggleCoordinateDisplay() {
        this.showCoordinates = !this.showCoordinates;
        this.updateCoordinateVisibility();
    }

    // Update visibility of all coordinate texts
    updateCoordinateVisibility() {
        this.coordinateTexts.forEach(text => {
            text.setVisible(this.showCoordinates);
        });
    }

    // Method to access the tiles map
    getTilesMap() {
        return this.tilesMap;
    }

    // Set and check obstacles
    setObstacle(x: number, y: number, isObstacle: boolean) {
        if (isObstacle) {
            this.obstaclesMap.set(serializeCoords(x, y), true);
        } else {
            this.obstaclesMap.delete(serializeCoords(x, y));
        }
    }

    hasObstacle(x: number, y: number): boolean {
        return this.obstaclesMap.has(serializeCoords(x, y));
    }

    // Clean up resources
    destroy() {
        this.coordinateTexts.forEach(text => text.destroy());
        this.tilesMap.forEach(tile => tile.destroy());
        this.coordinateTexts.clear();
        this.tilesMap.clear();
        this.obstaclesMap.clear();
        this.tileStates.clear();
    }

    // Get tilemap by coordinate
    getTile(x: number, y: number) {
        return this.tilesMap.get(serializeCoords(x, y));
    }

    getTiles() {
        return Array.from(this.tilesMap.values());
    }

    // Get hex dimensions for other components that need them
    getHexDimensions() {
        return {
            width: HexGridManager.HEX_WIDTH,
            height: HexGridManager.HEX_HEIGHT,
            horizSpacing: HexGridManager.HEX_HORIZ_SPACING,
            vertSpacing: HexGridManager.HEX_VERT_SPACING
        };
    }

    darkenAllTiles(tintColor: number) {
        this.isDarkened = true;
        this.tilesMap.forEach(tile => {
            const key = serializeCoords(
                // @ts-ignore
                tile.gridX, 
                // @ts-ignore
                tile.gridY
            );
            
            const state = this.tileStates.get(key);
            // @ts-ignore
            tile.previousTint = state?.highlights.get(HighlightType.HOVER) || state?.baseColor || tile.tint;
            tile.setTint(tintColor);
        });
    }

    brightenAllTiles() {
        this.isDarkened = false;
        this.tilesMap.forEach(tile => {
            const key = serializeCoords(
                // @ts-ignore
                tile.gridX, 
                // @ts-ignore
                tile.gridY
            );
            
            const state = this.tileStates.get(key);
            if (state) {
                const color = state.highlights.get(HighlightType.HOVER) || state.baseColor;
                this.applyTileColor(tile, color);
            } else {
                // @ts-ignore
                tile.setTint(tile.previousTint || TileColors.NORMAL);
            }
        });
    }

    // Get all tiles within a given radius
    private getTilesInRadius(x: number, y: number, radius: number) {
        return getTilesInHexRadius(x, y, radius);
    }

    // Update a tile when a character leaves it
    updateTileOnCharacterExit(gridX: number, gridY: number) {
        const key = serializeCoords(gridX, gridY);
        
        // Reset tile color to normal
        if (this.tileStates.has(key)) {
            this.tileStates.get(key).baseColor = TileColors.NORMAL;
            const tile = this.tilesMap.get(key);
            if (tile) {
                this.applyTileColor(tile, TileColors.NORMAL);
            }
        }
    }

    // Update a tile when a character enters it
    updateTileOnCharacterEnter(gridX: number, gridY: number, isPlayerTeam: boolean) {
        const key = serializeCoords(gridX, gridY);
        
        // Update tile color based on team
        const color = isPlayerTeam ? TileColors.PLAYER_TEAM : TileColors.ENEMY_TEAM;
        
        if (!this.tileStates.has(key)) {
            this.tileStates.set(key, { 
                baseColor: color, 
                highlights: new Map() 
            });
        } else {
            this.tileStates.get(key).baseColor = color;
        }
        
        // Apply the color to the tile
        const tile = this.tilesMap.get(key);
        if (tile) {
            this.applyTileColor(tile, color);
        }
    }
} 