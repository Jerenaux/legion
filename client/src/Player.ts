import { HealthBar } from "./HealthBar";

export class Player extends Phaser.GameObjects.Container {
    sprite: Phaser.GameObjects.Sprite;
    numKey: Phaser.GameObjects.Text;
    selectionOval: Phaser.GameObjects.Graphics;
    isPlayer: boolean = false;
    arena: Phaser.Scene;
    gridX: number;
    gridY: number;
    distance: number;

    constructor(scene: Phaser.Scene, gridX: number, gridY: number, x: number, y: number, num: number, texture: string, isPlayer: boolean) {
        super(scene, x, y);
        this.setDepth(3);
        this.isPlayer = isPlayer;
        this.gridX = gridX;
        this.gridY = gridY;
        this.arena = this.scene.scene.get('Arena');
        this.distance = 2;

        // Create the sprite using the given key and add it to the container
        this.sprite = scene.add.sprite(0, 0, texture);
        this.add(this.sprite);


        // Create a text object to display the player's name and score, and add it to the container
        if (isPlayer) {
            this.numKey = scene.add.text(30, 70, num.toString(), { fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1,1);
            this.add(this.numKey);

            // Create a Graphics object for the selection oval
            this.selectionOval = scene.add.graphics();
            this.selectionOval.lineStyle(4, 0xffd700, 1);
            this.selectionOval.strokeEllipse(0, 55, 70, this.sprite.height / 4);
            this.selectionOval.setVisible(false);
            this.add(this.selectionOval);

            this.moveTo(this.numKey, 2);
            this.moveTo(this.sprite, 1);

        } else {
            this.sprite.flipX = true;
        }

        this.add(new HealthBar(scene, 0, -40));

        // Add the container to the scene
        scene.add.existing(this);

        this.sprite.play(`${texture}_anim`);
    }

    toggleSelect() {
        this.selectionOval.setVisible(!this.selectionOval.visible);
        // @ts-ignore
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }
}
