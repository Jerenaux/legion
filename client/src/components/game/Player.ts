import { HealthBar } from "./HealthBar";
import { CircularProgress } from "./CircularProgress";
import { Team } from './Team';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { items, getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { Target } from "@legion/shared/enums";
import { Arena } from "./Arena";
import { HUD } from "./HUD";

export class Player extends Phaser.GameObjects.Container {
    sprite: Phaser.GameObjects.Sprite;
    numKey: Phaser.GameObjects.Text;
    selectionOval: Phaser.GameObjects.Graphics;
    glowFx: Phaser.FX.Glow;
    name = 'Player 1';
    isPlayer = false;
    texture: string;
    arena: Arena;
    hud: HUD;
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
    totalCooldownDuration: number;
    hurtTween: Phaser.Tweens.Tween;
    inventory: BaseItem[] = [];
    spells: BaseSpell[] = [];
    animationSprite: Phaser.GameObjects.Sprite;
    statusSprite: Phaser.GameObjects.Sprite;
    pendingSpell: number | null = null;
    pendingItem: number | null = null;
    casting = false;
    selected = false;
    HURT_THRESHOLD = 0.5;
    team: Team;
    animationLock = false;
    statuses: {
        frozen: number;
        paralyzed: number;
        burning: number;
        wet: number;
        poisoned: number;
        blind: number;
        mute: number;
        sleeping: number;
        charmed: number;
    };

    constructor(
        scene: Phaser.Scene, arenaScene: Arena, hudScene: HUD, team: Team, name: string, gridX: number, gridY: number, x: number, y: number,
        num: number, texture: string, isPlayer: boolean,
        hp: number, mp: number
        ) {
        super(scene, x, y);
        this.scene = scene;
        this.arena = arenaScene;
        this.hud = hudScene;

        this.team = team;
        this.texture = texture;
        this.name = name;
        this.isPlayer = isPlayer;
        this.distance = 2;
        this.maxHP = hp;
        this.hp = hp;
        this.num = num;

        this.statuses = {
            frozen: 0,
            paralyzed: 0,
            burning: 0,
            wet: 0,
            poisoned: 0,
            blind: 0,
            mute: 0,
            sleeping: 0,
            charmed: 0
        };

        this.baseSquare = scene.add.graphics().setAlpha(0.6);
        this.add(this.baseSquare);

        // Create the sprite using the given key and add it to the container
        this.sprite = scene.add.sprite(0, 0, texture);
        this.add(this.sprite);
        // @ts-ignore
        this.scene.sprites.push(this.sprite);

        // TODO: refactor as subclass
        if (isPlayer) {
            this.numKey = scene.add.text(30, 70, num.toString(), { fontFamily: 'Kim', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1,1);
            this.add(this.numKey);

            // Create a Graphics object for the selection oval
            this.selectionOval = scene.add.graphics();
            this.selectionOval.lineStyle(4, 0xffd700, 1);
            this.selectionOval.strokeEllipse(0, 55, 70, this.sprite.height / 4);
            this.selectionOval.setVisible(false);
            this.add(this.selectionOval);

            this.baseSquare.lineStyle(4, 0x0000ff); // blue color

            this.cooldown = new CircularProgress(scene, -8, 28, 10, 0xffc400).setVisible(false);
            this.add(this.cooldown);

            this.MPBar = new HealthBar(scene, 0, -40, 0x0099ff);
            this.add(this.MPBar);
            this.maxMP = mp;
            this.mp = mp;

            this.moveTo(this.numKey, 3);
            this.moveTo(this.sprite, 2);

        } else {
            this.baseSquare.lineStyle(4, 0xff0000); // red color
        }

        if (this.x < this.arena.gridWidth/2) this.sprite.flipX = true;

        this.healthBar = new HealthBar(scene, 0, -50, 0x00ff08);
        this.add(this.healthBar);

        this.baseSquare.strokeRect(-30, 10, 60, 60); // adjust position and size as needed
        this.baseSquare.setDepth(this.depth - 2);  

        this.animationSprite = scene.add.sprite(0, 20, '').setScale(2).setVisible(false);
        this.animationSprite.on('animationcomplete', () => this.animationSprite.setVisible(false), this);
        this.add(this.animationSprite);

        this.statusSprite = scene.add.sprite(0, -20, 'statuses').setOrigin(0.5, 0.1).setVisible(false);
        this.add(this.statusSprite);

        // Add the container to the scene
        scene.add.existing(this);
        this.updatePos(gridX, gridY);

        this.playAnim('idle');
        this.sprite.setInteractive(new Phaser.Geom.Rectangle(35, 40, 70, 100), Phaser.Geom.Rectangle.Contains);

        this.sprite.on('pointerover', this.onPointerOver, this);
        this.sprite.on('pointerout', this.onPointerOut, this);

        // Delay by X seconds
        scene.time.delayedCall(750, this.makeEntrance, [], this);
    }

    getProps() {
        return {
            name: this.name,
            number: this.num,
            portrait: this.texture,
            hp: this.hp,
            maxHp: this.maxHP,
            mp: this.mp,
            maxMp: this.maxMP,
            cooldown: this.cooldownDuration / 1000,
            maxCooldown: this.totalCooldownDuration / 1000,
            spells: this.spells,
            items: this.inventory,
            casting: this.casting,
          }
    }

    makeEntrance() {
        const callback = () => { this.playAnim('boast', true);};
        this.walkTo(this.gridX, this.gridY, 2000, callback);
    }

    isAlive() {
        return this.hp > 0;
    }

    isParalyzed() {
        return this.statuses.paralyzed || this.statuses.frozen;
    }

    canAct() {
        return this.cooldownDuration == 0 && this.isAlive() && !this.casting && !this.isParalyzed();
    }

    setDistance(distance: number) {
        this.distance = distance;
    }

    getIdleAnim() {
        if (this.hp <= 0) return 'die';
        return this.hp / this.maxHP < this.HURT_THRESHOLD ? 'idle_hurt' : 'idle';
    }

    handleAnimationComplete() {
        if (this.statuses.frozen) {
            return;
        }
        this.playAnim(this.getIdleAnim());
    }

    playAnim(key: string, revertToIdle = false) {
        if (this.animationLock) {
            return;
        }
        this.animationLock = true;

        this.sprite.removeListener('animationcomplete', this.handleAnimationComplete);
        this.sprite.anims.stop();

        if (this.statuses.frozen) {
            this.animationLock = false;
            return;
        }

        this.sprite.play(`${this.texture}_anim_${key}`);
        if (revertToIdle) {
            this.sprite.once('animationcomplete', this.handleAnimationComplete, this);
        }
        this.animationLock = false;
    }

    checkHeartbeat() {
        if (this.getHPpct() < this.HURT_THRESHOLD  && this.isAlive()) {
            this.arena.playSound('heart', 1, true);
        } else {
            this.arena.stopSound('heart');
        }
    }

    toggleSelect() {
        if (this.isSelected()) {
            this.deselect();
        } else {
            this.select();
        }
    }

    select() {
        this.selectionOval.setVisible(true);
        if (!this.glowFx) {
            this.glowFx = this.sprite.preFX.addGlow(0xffffff, 6);
        }
        this.glowFx.setActive(true);
        this.displayMovementRange();
        this.selected = true;

        this.checkHeartbeat();
    }

    deselect() {
        this.selectionOval.setVisible(false);
        this.hideMovementRange();
        this.selected = false;
        if (this.glowFx) {
            this.glowFx.setActive(false);
        }
    }

    isSelected() {
        return this.selected;
    }

    displayMovementRange() {
        if (!this.canAct()) return;
        if (this.pendingSpell != null) return;
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }

    hideMovementRange() {
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
        if (this.isTarget() && this.arena.selectedPlayer.pendingSpell == null) {
            this.hud.toggleCursor(true, 'swords');
        }
        if (!this.glowFx) { // Initialize the glow effect if it does not exist
            if (this.isSelected() || this.isPlayer) {
                // White glow for selected, blue for player hover
                const glowColor = this.isSelected() ? 0xffffff : (this.isPlayer ? 0x0000ff : 0xff0000);
                this.glowFx = this.sprite.preFX.addGlow(glowColor, 6);
            } else {
                this.glowFx = this.sprite.preFX.addGlow(0xff0000, 4);
            }
        }
        if (this.isPlayer && !this.isSelected()) {
            this.glowFx.color = 0x00ff00; // Blue glow
        }
        this.glowFx.setActive(true);
    }
    

    onPointerOut() {
        if (!this.isPlayer && this.arena.selectedPlayer?.pendingSpell == null) {
            this.hud.toggleCursor(false, 'scroll');
        }
        if (!this.isSelected()) { // Only deactivate if not selected
            if (this.glowFx && !this.isPlayer) {
                this.glowFx.setActive(false);
            } else if (this.isPlayer) {
                this.glowFx.color = 0xffffff; // Reset to white if selected, deactivate otherwise
                if (!this.isSelected()) {
                    this.glowFx.setActive(false);
                }
            }
        }
    }
    

    onClick() {
        this.arena.playSound('click');
        if (this.isPlayer) { // If clicking on a player of your team
            this.arena.selectPlayer(this);
        } else if(this.isTarget()) {
            this.arena.sendAttack(this);
            this.hud.toggleCursor(false);
        }
    }

    onLetterKey(keyCode) {
        // console.log(`Pressed ${keyCode}`);
        this.arena.playSound('click');
        const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        const itemsIndex = keyboardLayout.indexOf('Z');
        const index = keyboardLayout.indexOf(keyCode);
        if (index >= itemsIndex) {
            this.useItem(index - itemsIndex);
        } else {
            this.useSkill(index);
        }
    }

    getItemAtSlot(index): BaseItem | null {
        if (index >= this.inventory.length) return null;
        return this.inventory[index];
    }

    useItem(index) {
        // console.log(`Using item at slot ${index}`);
        const item = this.getItemAtSlot(index);
        if (!item) {
            console.error(`No item at slot ${index}`);
            return;
        }
        if (!this.canAct()) {
            console.error(`Can't act`);
            this.arena.playSound('nope', 0.2);
            return;
        }
        if (item) {
            if (item.target == Target.SELF) {
                this.arena.sendUseItem(index, this.x, this.y, this);
            } else {
                this.pendingItem = index;
                this.arena.toggleItemMode(true);
            }
        }
    }

    useItemAnimation(animation: string, name: string) {
        this.playAnim('item', true);
        this.playSuperimposedAnim(animation);
        this.displayOverheadText(name, 4000, '#fff');
    }

    castAnimation(flag: boolean, name: string) {
        if (flag) {
            this.playAnim('cast', false);
            this.animationSprite.setVisible(true).play('cast');
            this.displayOverheadText(name, 4000, '#fff');
            this.arena.playSound('cast', 1, true);
        } else {
            this.playAnim('idle');
            this.animationSprite.setVisible(false);
            this.arena.stopSound('cast');
        }
        this.casting = flag;
    }

    cancelSkill() {
        this.pendingSpell = null;
        this.arena.toggleTargetMode(false);
    }

    useSkill(index) {
        const spell = this.spells[index];
        if (!spell) {
            console.error(`No skill at slot ${index}`);
            return;
        }
        if (this.pendingSpell == index) {
            this.cancelSkill();
            return;
        }

        if (!this.canAct() || spell.cost > this.mp) {
            this.arena.playSound('nope', 0.2);
            return;
        }
        
        this.pendingSpell = index;
        this.arena.toggleTargetMode(true, spell.size);
    }

    isTarget() {
        return !this.isPlayer && this.isAlive() && this.arena.selectedPlayer?.isNextTo(this.gridX, this.gridY)
    }

    isNextTo(x: number, y: number) {
        return (Math.abs(x - this.gridX) <= 1 && Math.abs(y - this.gridY) <= 1);
    }

    walkTo(gridX: number, gridY: number, duration = 300, callback?: () => void) {
        const oldGridX = this.gridX;
        this.updatePos(gridX, gridY);
        this.playAnim('walk');

        const {x, y} = this.arena.gridToPixelCoords(gridX, gridY);
        this.scene.tweens.add({
            targets: this,
            props: {
                x,
                y,
            },
            duration,
            onComplete: () => {
                if (callback) {
                    callback();
                } else {
                    this.playAnim('idle');
                }
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

        if(this.isSelected()) this.checkHeartbeat();

        if (this.hp <= 0) {
            this.die();
        } else {
            if (!this.casting) this.playAnim('hurt', true);
            this.healthBar.setVisible(true);
            this.MPBar?.setVisible(true);
        }

        if(this.hp != _hp) {
            this.arena.emitEvent('hpChange', {num: this.num})
            this.team.updateHP();
        }
    }

    getHPpct() {
        return this.hp / this.maxHP;
    }

    setMP(mp) {
        const _mp = this.mp
        this.mp = mp;
        this.MPBar.setHpValue(mp / this.maxMP);

        if(this.mp != _mp) {
            this.arena.emitEvent('mpChange', {num: this.num})
        }
    }

    die() {
        this.healthBar.setVisible(false);
        this.MPBar?.setVisible(false);
        this.statusSprite.setVisible(false);
        this.playAnim('die');
        if (this.arena.selectedPlayer == this) this.arena.deselectPlayer();
    }

    attack(targetX: number) {
        this.playAnim('attack', true);
        console.log(`Attacking ${targetX} ${this.gridX}`);
        this.sprite.flipX = targetX > this.gridX;
        
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
        const randomXOffset = 0; //(Math.random() - 0.5) * 30; 
        const randomYOffset = 0; // (Math.random() - 0.5) * 10; 

        const textObject = this.scene.add.text(
            randomXOffset,( -this.sprite.height / 2) + 15 + randomYOffset, `${String(text)}`, 
            { fontSize: '24px', color, stroke: '#000', strokeThickness: 3, fontFamily: 'Kim',}
            ).setOrigin(0.5).setDepth(10)   ;
        this.add(textObject);
    
        // Create a tween to animate the damage text
        this.scene.tweens.add({
            targets: textObject,
            y: `-=${30 - randomYOffset}`,  // move up
            alpha: 0,   // fade out
            duration, 
            ease: 'Power2',  // smooth easing
            onComplete: () => {
                // remove the text when the tween is complete
                textObject.destroy();
            }
        });
    }

    displayDamage(damage) {
        const txt = damage > 0 ? `+${Math.round(damage)}` : `${Math.round(damage)}`;
        this.displayOverheadText(txt, 4000, '#fff');
    }

    displaySlash(attacker) {
        this.playSuperimposedAnim('slash');
        this.animationSprite.flipX = attacker.gridX > this.gridX;
    }

    playSuperimposedAnim(name) {
        if (this.arena.animationScales[name]) {
            this.animationSprite.setScale(this.arena.animationScales[name]);
        } else {
            this.animationSprite.setScale(2);
        }
        this.animationSprite.setVisible(true).play(name);
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
        this.totalCooldownDuration = duration;
        this.arena.emitEvent('cooldownStarted', {num: this.num})
        this.cooldown.setVisible(true);
        if (this.isSelected()) this.hideMovementRange();
        if (this.cooldownTween) this.cooldownTween.stop();
        this.cooldownTween = this.scene.tweens.add({
            targets: this.cooldown,
            progress: { from: 0, to: 1 }, // Start at 0 progress and tween to 1
            duration, // Duration of the tween in milliseconds
            ease: 'Linear', // Use a linear easing function
            onUpdate: () => {
                this.cooldownDuration = Math.floor(this.totalCooldownDuration * (1 - this.cooldown.progress));
                this.cooldown.draw(); // Redraw the circle on each update of the tween
                this.arena.emitEvent('cooldownChange', {num: this.num})
            },
            onComplete: () => {
                this.cooldown.setVisible(false);
                this.cooldownDuration = 0;
                if (this.isSelected()) this.displayMovementRange();
                this.arena.emitEvent('cooldownEnded', {num: this.num})
                if (this.selected) this.arena.playSound('cooldown');
            }
        });
    }

    setInventory(inventory: number[]) {
        this.inventory = [];
        inventory.forEach(itemId => {
            this.addItem(itemId);
        });
    }

    addItem(item: number) {
        this.inventory.push(getConsumableById(item));
    }

    setSpells(spellsIds: number[]) {
        // Map the spell IDs to the actual spell objects
        this.spells = spellsIds.map(spellId => {
            return getSpellById(spellId);
        });   
    }

    victoryDance() {
        if (this.isAlive()) this.playAnim('victory');
    }

    setStatuses(statuses) {
        if (!this.isAlive()) return;
        this.setFrozen(statuses.frozen);
        this.setParalyzed(statuses.paralyzed);
    }

    setFrozen(duration) {
        if (duration != 0) 
        {
            this.statuses.frozen = duration;   
            this.sprite.anims.stop();   
            this.cooldownTween?.stop();
        } else {
            this.statuses.frozen = 0;
            this.playAnim(this.getIdleAnim());
        }   
    }

    setParalyzed(duration) {
        if (duration != 0) {
            this.statuses.paralyzed = duration;
            this.sprite.anims.stop();
            this.cooldownTween?.stop();
            this.statusSprite.setVisible(true);
            this.statusSprite.anims.play('paralyzed');
        } else {
            this.statuses.paralyzed = 0;
            this.statusSprite.anims.stop();
            this.statusSprite.setVisible(false);
            this.playAnim(this.getIdleAnim());
        }
    }
}
