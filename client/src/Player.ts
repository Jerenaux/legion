import { HealthBar } from "./HealthBar";

export class Player extends Phaser.GameObjects.Container {
    scene: Phaser.Scene;
    sprite: Phaser.GameObjects.Sprite;
    numKey: Phaser.GameObjects.Text;
    selectionOval: Phaser.GameObjects.Graphics;
    isPlayer: boolean = false;
    texture: string;
    arena: Phaser.Scene;
    hud: Phaser.Scene;
    gridX: number;
    gridY: number;
    num: number;
    distance: number;
    baseSquare: Phaser.GameObjects.Graphics;
    maxHP: number;
    hp: number;
    healthBar: HealthBar;

    constructor(scene: Phaser.Scene, gridX: number, gridY: number, x: number, y: number, num: number, texture: string, isPlayer: boolean, hp: number) {
        super(scene, x, y);
        this.scene = scene;
        this.arena = this.scene.scene.get('Arena');
        this.hud = this.scene.scene.get('HUD');

        this.texture = texture;
        this.isPlayer = isPlayer;
        this.gridX = gridX;
        this.gridY = gridY;
        this.distance = 2;
        this.maxHP = hp;
        this.hp = hp;
        this.num = num;

        this.baseSquare = scene.add.graphics().setAlpha(0.6);
        this.add(this.baseSquare);

        // Create the sprite using the given key and add it to the container
        this.sprite = scene.add.sprite(0, 0, texture);
        this.add(this.sprite);

        // Create a Graphics object for the base square

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

            this.baseSquare.lineStyle(4, 0x0000ff); // blue color

            this.moveTo(this.numKey, 3);
            this.moveTo(this.sprite, 2);

        } else {
            this.sprite.flipX = true;
            this.baseSquare.lineStyle(4, 0xff0000); // red color
        }

        this.healthBar = new HealthBar(scene, 0, -40);
        this.add(this.healthBar);
        this.baseSquare.strokeRect(-30, 10, 60, 60); // adjust position and size as needed

        // Add the container to the scene
        scene.add.existing(this);
        this.setDepth(3);

        this.playAnim('idle');
        this.sprite.setInteractive(new Phaser.Geom.Rectangle(35, 40, 70, 100), Phaser.Geom.Rectangle.Contains);


        this.sprite.on('pointerover', this.onPointerOver, this);
        this.sprite.on('pointerout', this.onPointerOut, this);
        this.sprite.on('pointerup', this.onPointerUp, this);
    }

    isAlive() {
        return this.hp > 0;
    }

    setDistance(distance: number) {
        this.distance = distance;
    }

    playAnim(key: string, revertToIdle = false) {
        this.sprite.play(`${this.texture}_anim_${key}`);
        if (revertToIdle) {
            const idleAnim = this.hp / this.maxHP < 0.5 ? 'idle_hurt' : 'idle';
            this.sprite.once('animationcomplete', () => this.playAnim(idleAnim), this);
        }
    }

    toggleSelect() {
        this.selectionOval.setVisible(!this.selectionOval.visible);
        // @ts-ignore
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return Math.pow(x - this.gridX, 2) + Math.pow(y - this.gridY, 2) <= Math.pow(this.distance, 2);
    }

    updatePos(x, y) {
        this.gridX = x;
        this.gridY = y;
    }

    onPointerOver() {
        // @ts-ignore
        if(this.isTarget()) {
            // @ts-ignore
            this.hud.toggleSwordCursor(true);
        }
    }

    onPointerOut() {
        if(!this.isPlayer) {
            // @ts-ignore
            this.hud.toggleSwordCursor(false);
        }
    }

    onPointerUp() {
        if(this.isTarget()) {
            // @ts-ignore
            this.arena.sendAttack(this);
            // @ts-ignore
            this.hud.toggleSwordCursor(false);
        }
    }

    isTarget() {
        // @ts-ignore
        return !this.isPlayer && this.isAlive() && this.arena.selectedPlayer?.isNextTo(this.gridX, this.gridY)
    }

    isNextTo(x: number, y: number) {
        return (Math.abs(x - this.gridX) <= 1 && Math.abs(y - this.gridY) <= 1);
    }

    walkTo(gridX: number, gridY: number, x: number, y: number) {
        const oldGridX = this.gridX;
        this.updatePos(gridX, gridY);

        this.playAnim('walk');
        this.scene.tweens.add({
            targets: this,
            props: {
                x: x,
                y: y,
            },
            duration: 300,
            onComplete: () => {
                this.playAnim('idle');
            },
        });

        if(this.isPlayer) {
            if(gridX > oldGridX && !this.sprite.flipX) this.sprite.flipX = true;
            if(gridX < oldGridX && this.sprite.flipX) this.sprite.flipX = false;
        } else {
            if(gridX < oldGridX && !this.sprite.flipX) this.sprite.flipX = true;
            if(gridX > oldGridX && this.sprite.flipX) this.sprite.flipX = false;
        }
    }

    setHP(hp) {
        const _hp = this.hp
        this.hp = hp;
        this.healthBar.setHpValue(hp / this.maxHP);
        if (this.hp < _hp) {
            this.hurt();   
        }

        if (this.hp <= 0) {
            this.healthBar.setVisible(false);
            this.playAnim('die');
        } else {
            this.playAnim('hurt', true);
        }

    }

    attack(player: Player) {
        // @ts-ignore
        this.arena.deselectPlayer();
        this.playAnim('attack', true);
    }

    hurt() {
        
        // Blink
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 100,
            repeat: 2,
            yoyo: true,
            onComplete: () => {
                this.alpha = 1;
            }
        });
    }

    displayDamage(damage) {
        // Create the damage text
        let damageText = this.scene.add.text(0,( -this.sprite.height / 2) + 15, `-${String(damage)}`, { fontSize: '24px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        this.add(damageText);
    
        // Create a tween to animate the damage text
        this.scene.tweens.add({
            targets: damageText,
            y: '-=30',  // move up
            alpha: 0,   // fade out
            duration: 2000,  // 1 second
            ease: 'Power2',  // smooth easing
            onComplete: () => {
                // remove the text when the tween is complete
                damageText.destroy();
            }
        });
    }
}
