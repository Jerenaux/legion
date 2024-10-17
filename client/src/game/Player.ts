import { HealthBar } from "./HealthBar";
import { CircularProgress } from "./CircularProgress";
import { Team } from './Team';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { Target, StatusEffect, Class } from "@legion/shared/enums";
import { Arena } from "./Arena";
import { PlayerProps, StatusEffects } from "@legion/shared/interfaces";
import { paralyzingStatuses } from '@legion/shared/utils';
import { SpeechBubble } from "./SpeechBubble";
import { BASE_ANIM_FRAME_RATE } from '@legion/shared/config';

enum GlowColors {
    Enemy = 0xff0000,
    Ally = 0x00ff00,
    Selected = 0xffffff,
}

const BASE_SQUARE_ALPHA = 0.5;

export class Player extends Phaser.GameObjects.Container {
    sprite: Phaser.GameObjects.Sprite;
    numKey: Phaser.GameObjects.Text;
    selectionOval: Phaser.GameObjects.Graphics;
    glowFx: Phaser.FX.Glow;
    name = 'Player 1';
    isPlayer = false;
    texture: string;
    arena: Arena;
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
    statusSprites: Map<StatusEffect, Phaser.GameObjects.Sprite>;
    statusTimer: NodeJS.Timeout;
    pendingSpell: number | null = null;
    pendingItem: number | null = null;
    casting = false;
    selected = false;
    HURT_THRESHOLD = 0.5;
    team: Team;
    animationLock = false;
    statuses: StatusEffects;
    class: Class;
    xp: number;
    level: number;
    lastOverheadMessage: number;
    speechBubble: SpeechBubble;
    normalColor: number;
    goldenColor: number = 0xDAA520;
    blinkTween: Phaser.Tweens.Tween | null = null;

    constructor(
        scene: Phaser.Scene, arenaScene: Arena, team: Team, name: string, gridX: number, gridY: number, x: number, y: number,
        num: number, texture: string, isPlayer: boolean, characterClass: Class,
        hp: number, maxHP: number, mp: number, maxMP: number, level: number, xp: number,
        ) {
        super(scene, x, y);
        this.scene = scene;
        this.arena = arenaScene;

        this.team = team;
        this.texture = texture;
        this.name = name;
        this.isPlayer = isPlayer;
        this.distance = 2;
        this.maxHP = maxHP;
        this.maxMP = maxMP;
        this.hp = this.maxHP;
        this.mp = this.maxMP;
        this.num = num;
        this.class = characterClass;
        this.xp = xp;
        this.level = level;

        this.normalColor = isPlayer ? 0x0000ff : 0xff0000;
        this.baseSquare = scene.add.graphics().setAlpha(BASE_SQUARE_ALPHA);
        this.setBaseSquareColor(this.normalColor); // Use method to set color
        this.add(this.baseSquare);

        // Create the sprite using the given key and add it to the container
        this.sprite = scene.add.sprite(0, 0, texture);

        // Create a Graphics object for the selection oval
        this.selectionOval = scene.add.graphics();
        this.selectionOval.lineStyle(4, 0xffd700, 1);
        this.selectionOval.strokeEllipse(0, 55, 70, this.sprite.height / 4);
        this.selectionOval.setVisible(false);
        this.add(this.selectionOval);
        this.add(this.sprite); // Add sprite after selection oval for proper depth

        this.healthBar = new HealthBar(scene, 0, -50, 0x00ff08);
        this.add(this.healthBar);
        this.setHP(hp);

        if (isPlayer) {
            this.MPBar = new HealthBar(scene, 0, -40, 0x0099ff);
            this.add(this.MPBar);
            this.setMP(mp);
        }

        this.setUpStatusEffects();

        // For cast effect, slash effect, etc.
        this.animationSprite = scene.add.sprite(0, 20, '').setScale(2).setVisible(false);
        this.animationSprite.on('animationcomplete', () => this.animationSprite.setVisible(false), this);
        this.add(this.animationSprite);

        if (isPlayer) {
            this.numKey = scene.add.text(30, 70, num.toString(), { fontFamily: 'Kim', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1,1);
            this.add(this.numKey);

            this.cooldown = new CircularProgress(scene, -8, 28, 10, 0xffc400).setVisible(false);
            this.add(this.cooldown);
        } 

        this.baseSquare.fillStyle(isPlayer ? 0x0000ff : 0xff0000); // Must be called before strokeRect
        this.baseSquare.fillRect(-30, 10, 60, 60);  

        if (gridX < this.arena.gridWidth/2) this.sprite.flipX = true;

        // @ts-ignore
        this.scene.sprites.push(this.sprite);

        this.glowFx = this.sprite.preFX.addGlow(0x000000, 6);
        this.glowFx.setActive(false);

        // Add the container to the scene
        scene.add.existing(this);
        this.updatePos(gridX, gridY);

        this.playAnim('idle');
        this.sprite.setInteractive(new Phaser.Geom.Rectangle(35, 40, 70, 100), Phaser.Geom.Rectangle.Contains);

        this.sprite.on('pointerover', this.onPointerOver, this);
        this.sprite.on('pointerout', this.onPointerOut, this);
        this.sprite.on('pointerdown', this.onPointerDown, this);

        this.speechBubble = new SpeechBubble(this.scene, -15, (this.height / 2) - 10, 'Hello!').setVisible(false);
        this.add(this.speechBubble);
    }

    setUpStatusEffects() {
        const statusEffects = Object.keys(StatusEffect);

        this.statuses = {
            [StatusEffect.FREEZE]: 0,
            [StatusEffect.PARALYZE]: 0,
            [StatusEffect.POISON]: 0,
            [StatusEffect.BURN]: 0,
            [StatusEffect.SLEEP]: 0,
            [StatusEffect.MUTE]: 0,
            [StatusEffect.HASTE]: 0,
        };

        const yOffsets = {
            [StatusEffect.MUTE]: -30,
        };

        const xOffsets = {
            [StatusEffect.MUTE]: 10,
        };

        this.statusSprites = new Map();

        statusEffects.forEach(effect => {
            this.statuses[StatusEffect[effect]] = 0;

            const yOffset = yOffsets[StatusEffect[effect]] || 0;
            const xOffset = xOffsets[StatusEffect[effect]] || 0;

            const sprite = this.scene.add.sprite(0 + xOffset, -20 + yOffset, 'statuses')
                .setOrigin(0.5, 0.1)
                .setVisible(false);
            
            this.add(sprite);
            this.statusSprites.set(StatusEffect[effect], sprite);
            
            // Add to sprites list for kill cam effect
            // @ts-ignore
            this.scene.sprites.push(sprite);
        });
    }

    // Returns the fields needed to display the top screen Player box in-game.
    // For the fields needed for the team overviews on each side, see Team.ts:getOverview()
    getProps(): PlayerProps {
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
            statuses: this.statuses,
            pendingSpell: this.pendingSpell,
            pendingItem: this.pendingItem,
            isParalyzed: this.isParalyzed(),
          }
    }

    setBaseSquareColor(color: number) {
        this.baseSquare.clear();
        this.baseSquare.fillStyle(color, 0.6);
        this.baseSquare.fillRect(-30, 10, 60, 60);
    }

    hideBaseSquare() {
        this.baseSquare.setVisible(false);
    }

    showBaseSquare() {
        this.baseSquare.setVisible(true);
        this.baseSquare.setAlpha(BASE_SQUARE_ALPHA);
    }

    startBlinkingBaseSquare() {
        this.setBaseSquareColor(this.goldenColor);
        this.blinkTween = this.scene.tweens.add({
            targets: this.baseSquare,
            alpha: { from: 1, to: 0 },
            duration: 150,
            yoyo: true,
            repeat: -1
        });
    }

    stopBlinkingBaseSquare() {
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }
        this.setBaseSquareColor(this.normalColor);
        this.baseSquare.setAlpha(1);
    }

    makeEntrance(isTutorial = false) {
        const combatStartPhrases: string[] = [
            "Let's dance!",
            "Prepare to fall!",
            "Show me what you've got!",
            "This ends now!",
            "I've been waiting for this!",
            "Victory or death!",
            "No mercy!",
            "This is my moment!",
            "Let the battle begin!"
          ];
        const callback = () => { 
            this.playAnim('boast', true);
            // Say the phrase with a random delay
            if (this.isPlayer && !isTutorial) {
                setTimeout(() => {
                    this.talk(combatStartPhrases[Math.floor(Math.random() * combatStartPhrases.length)]);
                }, Math.random() * 600);
            }
        };
        this.walkTo(this.gridX, this.gridY, 2000, callback);
    }

    isAlive() {
        return this.hp > 0;
    }

    isFrozen() {
        if (!this.statuses) return false;
        return this.statuses[StatusEffect.FREEZE] != 0;
    }

    isParalyzed() {
        return (this.statuses[StatusEffect.PARALYZE] != 0) || this.isFrozen();
    }

    isMuted() {
        return this.statuses[StatusEffect.MUTE] != 0;
    }

    isHasted() {
        if (!this.statuses) return false;
        return this.statuses[StatusEffect.HASTE] != 0;
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
        if (this.isFrozen()) return;
        this.playAnim(this.getIdleAnim());
    }

    playAnim(key: string, revertToIdle = false) {
        if (this.animationLock) {
            return;
        }
        this.animationLock = true;

        this.sprite.removeListener('animationcomplete', this.handleAnimationComplete);
        this.sprite.anims.stop();

        if (this.isFrozen()) {
            this.animationLock = false;
            console.log(`Blocking animation`);
            return;
        }

         // Check if there is another player on the cell above
         if (this.arena.hasPlayer(this.gridX, this.gridY - 1)) {
            if (key == 'idle') key = 'hurt';
         };

        // console.log(`Playing animation ${key}`);
        this.sprite.play({
            key: `${this.texture}_anim_${key}`,
            frameRate: this.isHasted() ? BASE_ANIM_FRAME_RATE * 1.5 : BASE_ANIM_FRAME_RATE,
        });
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
        this.glowFx.color = GlowColors.Selected;
        this.glowFx.setActive(true);
        this.displayMovementRange();
        this.selected = true;

        this.checkHeartbeat();
    }

    deselect() {
        this.selectionOval.setVisible(false);
        this.hideMovementRange();
        this.selected = false;
        this.glowFx.setActive(false);
        this.pendingSpell = null;
        this.pendingItem = null;
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
        this.setDepth(this.arena.yToZ(y));
    }

    onPointerOver() {
        if (this.isTarget() && this.arena.selectedPlayer.pendingSpell == null) {
            this.arena.emitEvent('hoverEnemyCharacter');
        } else if (this.isPlayer){
            this.arena.emitEvent('hoverCharacter');
        }
        /**
         * If `isPlayer` is false, glow in red
         * Otherwise,
         * if `isSelected()` is true, do nothing
         * else, glow in green
         */
        let glowColor;
        if (!this.isPlayer) {
            glowColor = GlowColors.Enemy;
        } else if (!this.isSelected()) {
            glowColor = GlowColors.Ally;
        }
        if (glowColor) {
            this.glowFx.color = glowColor;
            this.glowFx.setActive(true);
        }
    }
    
    onPointerOut() {
        this.arena.emitEvent('unhoverCharacter');
        if (this.isSelected()) return;
        this.glowFx.setActive(false);
    }

    onPointerDown() {
        // const selectedPlayer = this.arena.selectedPlayer;
        // if (!selectedPlayer || (!selectedPlayer?.hasPendingSpell() && !selectedPlayer?.hasPendingItem())) {
        //     console.log('Relaying pointer down to handle click');
        //     this.arena.handleTileClick(this.gridX, this.gridY);
        // }
    }

    hasPendingSpell() {
        return this.pendingSpell != null;
    }

    hasPendingItem() {
        return this.pendingItem != null;
    }

    isInIce() {
        return this.arena.hasObstacle(this.gridX, this.gridY);
    }
    
    onClick() {
        this.arena.playSound('click');
        if (this.isPlayer && !this.isInIce()) { // If clicking on a player of your team
            this.arena.selectPlayer(this);
        } else if(this.isTarget()) {
            this.arena.sendAttack(this);
        }
    }

    onLetterKey(keyCode) {
        this.arena.playSound('click');
        const qwertyLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        const azertyLayout = 'AZERTYUIOPQSDFGHJKLMWXCVBN';
        
        // Get the current keyboard layout from settings
        const settingsString = localStorage.getItem('gameSettings');
        const settings = settingsString ? JSON.parse(settingsString) : { keyboardLayout: 0 };
        const layout = settings.keyboardLayout === 0 ? azertyLayout : qwertyLayout;

        const index = layout.indexOf(keyCode);
        this.onKey(index);
    }

    onKey(keyIndex) {
        const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        const itemsIndex = keyboardLayout.indexOf('Z');
        if (keyIndex >= itemsIndex) {
            this.useItem(keyIndex - itemsIndex);
        } else {
            this.useSkill(keyIndex);
        }
    }

    getItemAtSlot(index): BaseItem | null {
        if (index >= this.inventory.length) return null;
        return this.inventory[index];
    }

    useItem(index) {
        // console.log(`Using item at slot ${index}`);
        if (this.pendingItem == index) {
            this.cancelItem();
            return;
        }
        if (this.pendingSpell != null) {
            this.cancelSkill();
        }
        const item = this.getItemAtSlot(index);
        if (!item) {
            return;
        }
        if (!this.canAct()) {
            this.arena.playSound('nope', 0.2);
            return;
        }
        if (item) {
            if (item.target == Target.SELF) {
                this.arena.sendUseItem(index, this.x, this.y, this);
            } else {
                this.pendingItem = index;
                this.arena.toggleItemMode(true);
                this.arena.emitEvent('pendingItemChange');
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
            this.arena.playSound('cast', 1);
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
        this.arena.emitEvent('pendingSpellChange');
    }

    cancelItem() {
        this.pendingItem = null;
        this.arena.toggleTargetMode(false);
        this.arena.toggleItemMode(false);
        this.arena.emitEvent('pendingItemChange');
    }

    useSkill(index) {
        const spell = this.spells[index];
        if (!spell) {
            // console.error(`No spell at slot ${index}`);
            return;
        }
        if (this.pendingSpell == index) {
            this.cancelSkill();
            return;
        }
        if (this.pendingItem != null) {
            this.cancelItem();
        }
        if (!this.canAct() || spell.cost > this.mp || this.isMuted()) {
            this.arena.playSound('nope', 0.2);
            if (this.isMuted()) {
                this.talk('I\'m silenced! I can\'t cast spells!');
            }
            if (this.mp < spell.cost) {
                this.talk('Not enough MP!');
            }
            return;
        }
        
        this.pendingSpell = index;
        this.arena.toggleTargetMode(true, spell.size);
        this.arena.emitEvent('pendingSpellChange');
    }

    isTarget() {
        return (!this.isPlayer || this.isInIce())
            && this.isAlive()
            && this.arena.selectedPlayer?.isNextTo(this.gridX, this.gridY)
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
            this.showBaseSquare(); // Show baseSquare when alive
            
            if (!(this.isPlayer && this.cooldownDuration === 0)) {
                this.setBaseSquareColor(this.normalColor); // Ensure normal color
            }

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
        this.hideAllStatusAnimations();
        this.playAnim('die');
        this.hideBaseSquare(); // Hide baseSquare when dead
        this.stopBlinkingBaseSquare(); // Stop blinking if any
        if (this.arena.selectedPlayer == this) this.arena.deselectPlayer();

        const deathPhrases: string[] = [
            "Not like this...",
            "You'll regret that!",
            "Avenge me!",
            "I'll be back",
            "Curse you!",
            "Into the void...",
            "Remember my name...",
            "This isn't over!",
          ];
        const phrase = deathPhrases[Math.floor(Math.random() * deathPhrases.length)];
        // this.talk(phrase);
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
        let randomYOffset = 0; // (Math.random() - 0.5) * 10; 

        if (Date.now() - this.lastOverheadMessage < 100) {
            randomYOffset -= 30;
        }

        const textObject = this.scene.add.text(
            randomXOffset,( -this.sprite.height / 2) + 15 + randomYOffset, `${String(text)}`, 
            { fontSize: '24px', color, stroke: '#000', strokeThickness: 3, fontFamily: 'Kim',}
            ).setOrigin(0.5).setDepth(10)   ;
        this.add(textObject);
        this.lastOverheadMessage = Date.now();
    
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

    setCooldown(duration) {
        this.cooldownDuration = duration;
        this.totalCooldownDuration = duration;
        this.arena.emitEvent('cooldownStarted', {num: this.num})
        this.cooldown.setVisible(true);
        
        if (this.isSelected()) this.hideMovementRange();
        if (this.cooldownTween) this.cooldownTween.stop();
        if (this.isPlayer) this.stopBlinkingBaseSquare();

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
                this.arena.playSound('cooldown');

                // if (this.isPlayer) {
                //     this.startBlinkingBaseSquare();
                // }
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

    setStatuses(statuses: StatusEffects) {
        Object.keys(statuses).forEach(status => {
            const duration = statuses[status];
            this.statuses[status] = duration;
            if (duration != 0) {
                this.showStatusAnimation(status as keyof StatusEffects);
                this.setStatusTimer();
            } else {
                this.hideStatusAnimation(status as keyof StatusEffects);
            } 
        });

        // Compute if any of the paralyzing statuses are active
        const paralyzing = paralyzingStatuses.some(status => statuses[status] != null && statuses[status] != 0);
        this.toggleCharacterImmobilization(paralyzing);

        this.arena.emitEvent('statusesChange', {num: this.num})
    }

    setStatusTimer() {
        if (this.statusTimer) return;
        let change = false;
        this.statusTimer = setInterval(() => {
            Object.keys(this.statuses).forEach(status => {
                if (this.statuses[status] > 0) {
                    change = true;
                    this.statuses[status] -= 1
                };
            });
            if (change) {
                this.arena.emitEvent('statusesChange', {num: this.num});
            } else {
                this.clearStatusTimer()
            }
        }, 1000);
    }

    clearStatusTimer() {
        clearInterval(this.statusTimer);
        this.statusTimer = null;
    }

    showStatusAnimation(status: StatusEffect) {
        const keys = {
            [StatusEffect.FREEZE]: 'freeze',
            [StatusEffect.PARALYZE]: 'paralyzed',
            [StatusEffect.POISON]: 'poisoned',
            [StatusEffect.BURN]: 'burn',
            [StatusEffect.SLEEP]: 'sleep',
            [StatusEffect.MUTE]: 'muted',
        };
        if (!keys[status]) return;
        const sprite = this.statusSprites.get(status);
        if (sprite) {
            sprite.setVisible(true);
            sprite.anims.play(keys[status]);
        }
    }

    hideStatusAnimation(status: StatusEffect) {
        const sprite = this.statusSprites.get(status);
        if (sprite) {
            sprite.setVisible(false);
            sprite.anims.stop();
        }
    }

    hideAllStatusAnimations() {
        if (!this.statusSprites) return;
        this.statusSprites.forEach(sprite => {
            sprite.setVisible(false);
            sprite.anims.stop();
        });
    }

    toggleCharacterImmobilization(flag: boolean) {
        if (flag) 
        {
            this.sprite.anims.stop();   
            if (this.cooldownTween?.progress < 1) this.cooldownTween?.pause();
        } else {
            this.playAnim(this.getIdleAnim());
            if (this.cooldownTween?.paused) this.cooldownTween?.play();
        }   
    }

    setPoisoned(duration) {
        if (duration != 0) {
            this.statuses[StatusEffect.POISON] = duration;
            this.showStatusAnimation(StatusEffect.POISON);
        } else {
            this.statuses[StatusEffect.POISON] = 0;
            this.hideStatusAnimation(StatusEffect.POISON);
        }
    }

    async talk(text: string, sticky = false) {
        if (!this.speechBubble) return;
        if (this.speechBubble.visible && this.speechBubble.getText() == text) return;
        if (this.speechBubble.visible) {
            this.hideBubble();
        }
        
        // @ts-ignore
        await this.scene.sleep(10);
        this.speechBubble.setText(text);
        this.speechBubble.setVisible(true);
        const duration = this.speechBubble.setDuration(sticky);
        return duration;
    }


    hideBubble() {
        this.speechBubble.setVisible(false);
    }

    destroy() {
        this.clearStatusTimer();

        // Stop all tweens related to this player
        if (this.scene?.tweens) {
            this.scene.tweens.killTweensOf(this);
            this.scene.tweens.killTweensOf(this.baseSquare);
        }
    
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }

        // Stop any ongoing animations
        this.sprite.anims?.stop();
        this.animationSprite.anims.stop();
    
        // Call the parent class's destroy method
        super.destroy();
      }
}