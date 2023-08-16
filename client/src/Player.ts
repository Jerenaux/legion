import { HealthBar } from "./HealthBar";
import { CircularProgress } from "./CircularProgress";

interface NetworkInventory {
    item: Item;
    quantity: number;
}
interface Item {
    id: number;
    name: string;
    description: string;
    frame: string;
    effects: ItemEffect[];
    target: string;
    cooldown: number;
}

interface ItemEffect {
    stat: string;
    value: number;
}

export interface NetworkSpell {
    id: number;
    name: string;
    description: string;
    frame: string;
    cost: number;
    target: string;
    effects: NetworkSpellEffect[];
}

export interface NetworkSpellEffect {
    stat: string;
    value: number;
    modifiers: NetworkEffectModifiers | null;
}

export interface NetworkEffectModifiers {
    casterModifier: NetworkEffectModifier;
    targetModifier: NetworkEffectModifier;
}

export interface NetworkEffectModifier {
    stat: string;
    value: number;
    direction: string;
}

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
    maxMP: number;
    hp: number;
    mp: number;
    healthBar: HealthBar;
    MPBar: HealthBar;
    cooldown: CircularProgress;
    cooldownTween: Phaser.Tweens.Tween;
    cooldownDuration: number;
    hurtTween: Phaser.Tweens.Tween;
    inventory: Map<Item, number> = new Map<Item, number>();
    spells: NetworkSpell[] = [];
    animationSprite: Phaser.GameObjects.Sprite;
    pendingSkill: number | null = null;
    casting: boolean = false;

    constructor(
        scene: Phaser.Scene, gridX: number, gridY: number, x: number, y: number,
        num: number, texture: string, isPlayer: boolean,
        hp: number, mp: number
        ) {
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

        // TODO: refactor as subclass
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

            this.MPBar = new HealthBar(scene, 0, -40, 0x0099ff);
            this.add(this.MPBar);
            this.maxMP = mp;
            this.mp = mp;

            this.moveTo(this.numKey, 3);
            this.moveTo(this.sprite, 2);

        } else {
            this.sprite.flipX = true;
            this.baseSquare.lineStyle(4, 0xff0000); // red color
        }

        this.healthBar = new HealthBar(scene, 0, -50, 0x00ff08);
        this.add(this.healthBar);

        this.baseSquare.strokeRect(-30, 10, 60, 60); // adjust position and size as needed
        this.baseSquare.setDepth(this.depth - 2);  

        this.animationSprite = scene.add.sprite(0, 20, '').setScale(2).setVisible(false);
        this.add(this.animationSprite);

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

        const items = Array.from(this.inventory.entries()).map(([item, quantity]) => {
            return {
                ...item,
                quantity: quantity
            }    
        });        

        return {
            name: 'Player 1',
            number: this.num,
            portrait: textureFilename,
            hp: this.hp,
            maxHp: this.maxHP,
            mp: this.mp,
            maxMp: this.maxMP,
            cooldown: this.cooldownDuration / 1000,
            spells: this.spells,
            items,
            casting: this.casting,
          }
    }

    isAlive() {
        return this.hp > 0;
    }

    canAct() {
        return this.cooldownDuration == 0 && this.isAlive() && !this.casting;
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
        if (!this.canAct()) return;
        if (this.pendingSkill != null) return;
        // @ts-ignore
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }

    hideMovementRange() {
        // @ts-ignore
        this.arena.clearHighlight();
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return this.canAct() && Math.pow(x - this.gridX, 2) + Math.pow(y - this.gridY, 2) <= Math.pow(this.distance, 2);
    }

    updatePos(x, y) {
        this.gridX = x;
        this.gridY = y;
        this.setDepth(3 + this.gridY/10);
    }

    onPointerOver() {
        // @ts-ignore
        if(this.isTarget() && this.arena.selectedPlayer.pendingSkill == null) {
            // @ts-ignore
            this.hud.toggleCursor(true, 'swords');
        }
    }

    onPointerOut() {
        if(!this.isPlayer) {
            // @ts-ignore
            this.hud.toggleCursor(false);
        }
    }

    onClick() {
        if (this.isPlayer) { // If clicking on a player of your team
            // @ts-ignore
            this.arena.selectPlayer(this);
        } else if(this.isTarget()) {
            // @ts-ignore
            this.arena.sendAttack(this);
            // @ts-ignore
            this.hud.toggleCursor(false);
        }
    }

    onLetterKey(keyCode) {
        console.log(`Pressed ${keyCode}`);
        const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        const itemsIndex = keyboardLayout.indexOf('Z');
        const index = keyboardLayout.indexOf(keyCode);
        if (index >= itemsIndex) {
            this.useItem(index - itemsIndex);
        } else {
            this.useSkill(index);
        }
    }

    getItemAtSlot(index) {
        const entry = Array.from(this.inventory.entries())[index]
        if (entry) return entry[0];
        return null;
    }

    useItem(index) {
        // console.log(`Using item at slot ${index}`);
        const item = this.getItemAtSlot(index);
        if (!item) {
            console.error(`No item at slot ${index}`);
            return;
        }
        if (item) {
            if (item.target == 'SELF') {
                // @ts-ignore
                this.arena.sendUseItem(this, index);
            }
        }
    }

    useItemAnimation(animation: string, name: string) {
        this.playAnim('item', true);
        this.animationSprite.setVisible(true).play(animation);
        this.displayOverheadText(name, 4000, '#fff');
    }

    castAnimation(flag: boolean, name: string) {
        if (flag) {
            this.playAnim('cast', false);
            this.animationSprite.setVisible(true).play('cast');
            this.displayOverheadText(name, 4000, '#fff');
        } else {
            this.playAnim('idle');
            this.animationSprite.setVisible(false);
        }
        this.casting = flag;
    }

    cancelSkill() {
        this.pendingSkill = null;
        // @ts-ignore
        this.arena.toggleTargetMode(false);
    }

    useSkill(index) {
        if (!this.canAct()) return;
        const spell = this.spells[index];
        if (!spell) {
            console.error(`No skill at slot ${index}`);
            return;
        }
        if (this.pendingSkill == index) {
            this.cancelSkill();
            return;
        }

        if (spell.cost > this.mp) return;

        if (spell.target == 'AOE') {
            this.pendingSkill = index;
            // @ts-ignore
            this.arena.toggleTargetMode(true, spell.size);
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
            this.die();
        } else {
            if (!this.casting) this.playAnim('hurt', true);
        }

        if(this.hp != _hp) {
            // @ts-ignore
            this.arena.emitEvent('hpChange', {num: this.num})
        }
    }

    setMP(mp) {
        const _mp = this.mp
        this.mp = mp;
        this.MPBar.setHpValue(mp / this.maxMP);

        if(this.mp != _mp) {
            // @ts-ignore
            this.arena.emitEvent('mpChange', {num: this.num})
        }
    }

    die() {
        this.healthBar.setVisible(false);
        this.MPBar?.setVisible(false);
        this.playAnim('die');
        // @ts-ignore
        if (this.arena.selectedPlayer == this) this.arena.deselectPlayer();
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

    displayOverheadText(text, duration, color) {
        let textObject = this.scene.add.text(
            0,( -this.sprite.height / 2) + 15, `${String(text)}`, 
            { fontSize: '24px', color, stroke: '#000', strokeThickness: 3 }
            ).setOrigin(0.5).setDepth(10)   ;
        this.add(textObject);
    
        // Create a tween to animate the damage text
        this.scene.tweens.add({
            targets: textObject,
            y: '-=30',  // move up
            alpha: 0,   // fade out
            duration,  // 1 second
            ease: 'Power2',  // smooth easing
            onComplete: () => {
                // remove the text when the tween is complete
                textObject.destroy();
            }
        });
    }

    displayDamage(damage) {
        this.displayOverheadText(damage, 2000, '#fff');
    }

    // Function to toggle grayscale shader for a given sprite
    // toggleGrayscale() {
    //     if (this.canAct()) { // If grayscale already applied
    //         this.sprite.resetPipeline(); // Reset to default pipeline
    //     } else { // If grayscale not applied
    //         this.sprite.setPipeline('GrayScale'); // Apply the grayscale pipeline
    //     }
    // }

    setCooldown(duration) {
        // this.sprite.anims.stop();
        // this.toggleGrayscale();
        this.cooldownDuration = duration;
        // @ts-ignore
        this.arena.emitEvent('cooldownStarted', {num: this.num})
        this.cooldown.setVisible(true);
        if (this.isSelected()) this.hideMovementRange();
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
                this.cooldown.setVisible(false);
                this.cooldownDuration = 0;
                // this.playAnim('idle');
                if (this.isSelected()) this.displayMovementRange();
                // @ts-ignore
                this.arena.emitEvent('cooldownEnded', {num: this.num})
            }
        });
    }

    setInventory(inventory: NetworkInventory[]) {
        inventory.forEach(data => {
            console.log(data.item);
            this.addItem(data.item, data.quantity);
        });
    }

    addItem(item: Item, quantity: number) {
        const currentQuantity = this.inventory.get(item) || 0;
        this.inventory.set(item, currentQuantity + quantity);
    }

    updateItemNb(index: number, quantity: number) {
        const item = this.getItemAtSlot(index);
        this.inventory.set(item, quantity);
    }

    setSpells(spells: NetworkSpell[]) {
        this.spells = spells;
    }
}
