import { lineOfSight, serializeCoords, isSkip, getTilesInHexRadius } from '@legion/shared/utils';
import { GRID_WIDTH, GRID_HEIGHT } from '@legion/shared/config';

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

    private onTileHover(gridX: number, gridY: number, hover: boolean) {
        const tile = this.getTile(gridX, gridY);
        if (tile) {
            if (hover) {
                // @ts-ignore
                tile.previousTint = tile.tint;
                tile.setTint(0x00ff00);
            } else {
                // @ts-ignore
                tile.setTint(tile.previousTint);
            }
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
    highlightTilesInRadius(gridX: number, gridY: number, radius: number, color: number = 0x00ffff, shouldHighlight?: (x: number, y: number) => boolean) {
        const tilesInRadius = this.getTilesInRadius(gridX, gridY, radius);
        
        for (const tile of tilesInRadius) {
            if (!this.isValidGridPosition(tile.x, tile.y)) continue;
            
            if (shouldHighlight && !shouldHighlight(tile.x, tile.y)) continue;
            
            const tileSprite = this.tilesMap.get(serializeCoords(tile.x, tile.y));
            if (tileSprite) {
                tileSprite.setTint(color);
            }
        }
    }

    // Get all tiles within a given radius
    private getTilesInRadius(x: number, y: number, radius: number) {
        return getTilesInHexRadius(x, y, radius);
    }

    // Clear all highlighted tiles
    clearHighlight() {
        this.tilesMap.forEach(tileSprite => {
            tileSprite.clearTint();
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
        this.tilesMap.forEach(tile => {
            // @ts-ignore
            tile.previousTint = tile.tint;
            tile.setTint(tintColor);
        });
    }

    brightenAllTiles() {
        this.tilesMap.forEach(tile => {
            // @ts-ignore
            tile.setTint(tile.previousTint);
        });
    }
} 