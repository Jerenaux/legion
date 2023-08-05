import { HealthBar } from "./HealthBar";
import { CircularProgress } from "./CircularProgress";
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
    cooldown: CircularProgress;
    cooldownTween: Phaser.Tweens.Tween;
    cooldownDuration: number;
    hurtTween: Phaser.Tweens.Tween;
    canAct: boolean = false;

    constructor(scene: Phaser.Scene, gridX: number, gridY: number, x: number, y: number, num: number, texture: string, isPlayer: boolean, hp: number) {
        super(scene, x, y);
        this.scene = scene;
        this.arena = this.scene.scene.get('Arena');
        this.hud = this.scene.scene.get('HUD');

        this.texture = texture;
        this.isPlayer = isPlayer;
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

            this.cooldown = new CircularProgress(scene, -8, 28, 10, 0x87CEFA).setVisible(false);
            this.add(this.cooldown);

            this.moveTo(this.numKey, 3);
            this.moveTo(this.sprite, 2);

        } else {
            this.sprite.flipX = true;
            this.baseSquare.lineStyle(4, 0xff0000); // red color
        }

        this.healthBar = new HealthBar(scene, 0, -40);
        this.add(this.healthBar);

        this.baseSquare.strokeRect(-30, 10, 60, 60); // adjust position and size as needed
        this.baseSquare.setDepth(this.depth - 2);  
        // Add the container to the scene
        scene.add.existing(this);
        this.updatePos(gridX, gridY);

        this.playAnim('idle');
        this.sprite.setInteractive(new Phaser.Geom.Rectangle(35, 40, 70, 100), Phaser.Geom.Rectangle.Contains);

        this.sprite.on('pointerover', this.onPointerOver, this);
        this.sprite.on('pointerout', this.onPointerOut, this);
    }

    getProps() {
        // @ts-ignore
        const textureFile = this.arena.assetsMap[this.texture];
        // Extract the filename from the path
        const textureFilename = textureFile.split('/').pop();
        return {
            name: 'Player 1',
            number: this.num,
            portrait: textureFilename,
            hp: this.hp,
            maxHp: this.maxHP,
            mp: 100,
            maxMp: 100,
            cooldown: this.cooldownDuration / 1000,
            skills: [
              { name: 'Ice ball', frame: '01.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat'},
              { name: 'Fire ball', frame: '10.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat' },
              { name: 'Maelstrom', frame: '21.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat' },
              { name: 'Zombie', frame: '47.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat' },
            ],
            items: [
              { name: 'Potion', quantity: 2, frame: 'potion.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat' },
              { name: 'Ether', quantity: 1, frame: 'ether.png', description: 'Lorem ipsum dolor sit amet conecuetur dolores sit erat' },
            ]
          }
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
        this.displayMovementRange();
    }

    isSelected() {
        return this.selectionOval.visible;
    }

    displayMovementRange() {
        if (!this.canAct || !this.isAlive()) return;
        // @ts-ignore
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return this.canAct && Math.pow(x - this.gridX, 2) + Math.pow(y - this.gridY, 2) <= Math.pow(this.distance, 2);
    }

    updatePos(x, y) {
        this.gridX = x;
        this.gridY = y;
        this.setDepth(3 + this.gridY/10);
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

    onClick() {
        if (this.isPlayer) {
            // @ts-ignore
            this.arena.selectPlayer(this);
        } else if(this.isTarget()) {
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

        if (oldGridX != this.gridX) this.sprite.flipX = this.gridX > oldGridX;
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

        if(this.hp != _hp) {
            // @ts-ignore
            this.arena.emitEvent('hpChange', {num: this.num})
        }
    }

    attack(target: Player) {
        this.playAnim('attack', true);
        this.sprite.flipX = target.gridX > this.gridX;
    }

    hurt() {
        if (this.hurtTween?.isPlaying()) this.hurtTween.complete();
        // Blink
        this.hurtTween = this.scene.tweens.add({
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

    // Function to toggle grayscale shader for a given sprite
    toggleGrayscale() {
        if (this.canAct) { // If grayscale already applied
            this.sprite.resetPipeline(); // Reset to default pipeline
        } else { // If grayscale not applied
            this.sprite.setPipeline('GrayScale'); // Apply the grayscale pipeline
        }
    }

    setCooldown(duration) {
        // this.sprite.anims.stop();
        this.canAct = false;
        // this.toggleGrayscale();
        this.cooldownDuration = duration;
        this.cooldown.setVisible(true);
        if (this.cooldownTween) this.cooldownTween.stop();
        this.cooldownTween = this.scene.tweens.add({
            targets: this.cooldown,
            progress: { from: 0, to: 1 }, // Start at 0 progress and tween to 1
            duration: duration, // Duration of the tween in milliseconds
            ease: 'Linear', // Use a linear easing function
            onUpdate: () => {
                this.cooldown.draw(); // Redraw the circle on each update of the tween
            },
            onComplete: () => {
                this.canAct = true;
                this.cooldown.setVisible(false);
                this.cooldownDuration = 0;
                // this.playAnim('idle');
                if (this.isSelected()) this.displayMovementRange();
            }
        });
    }
}
