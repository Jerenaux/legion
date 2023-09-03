export class CellsHighlight extends Phaser.GameObjects.Graphics {
    size: number;
    color: number;
    gridWidth: number;
    gridHeight: number;
    tileSize: number;
    gridCorners: any;
    lastX: number;
    lastY: number;

    constructor(scene: Phaser.Scene, gridWidth: number, gridHeight: number, tileSize: number, gridCorners: any) {
        super(scene);
        this.scene = scene;
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.gridCorners = gridCorners;
        this.tileSize = tileSize;
        this.lastX = -1;
        this.lastY = -1;
        this.setNormalMode();
        scene.add.existing(this);
    }

    setNormalMode(refresh?: boolean) {
        this.size = 0;
        this.color = 0xffffff;
        if (refresh) this.move(this.lastX, this.lastY);
    }

    setTargetMode(size: number, refresh?: boolean) {
        this.size = Math.floor(size/2);
        this.color = 0xff0000;
        if (refresh) this.move(this.lastX, this.lastY);
    }

    setItemMode(refresh?: boolean) {
        this.size = 0;
        this.color = 0x00ff00;
        if (refresh) this.move(this.lastX, this.lastY);
    }

    move(gridX, gridY) {
        // Clear the previous highlight
        this.clear();
        // console.log(`gridX: ${gridX}, gridY: ${gridY}`);
        for(let x = gridX - this.size; x <= gridX + this.size; x++) {
            for(let y = gridY - this.size; y <= gridY + this.size; y++) {
                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    // @ts-ignore
                    if (this.scene.isSkip(x, y)) continue;

                    // Draw a new highlight over the hovered tile
                    this.fillStyle(this.color, 0.3); 
                    this.fillRect(
                        this.gridCorners.startX + x * this.tileSize, 
                        this.gridCorners.startY + y * this.tileSize, 
                        this.tileSize, this.tileSize
                    );
                }
            }
        }
        this.lastX = gridX;
        this.lastY = gridY;
    }
}