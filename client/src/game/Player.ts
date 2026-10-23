import {t, fontFamily} from '../i18n/core';
import { HealthBar } from "./HealthBar";
import { Team } from './Team';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { Target, StatusEffect, Class, Stat } from "@legion/shared/enums";
import { Arena } from "./Arena";
import { PlayerProps, StatusEffects, CharacterStats } from "@legion/shared/interfaces";
import { paralyzingStatuses } from '@legion/shared/utils';
import { SpeechBubble } from "./SpeechBubble";
import { BASE_ANIM_FRAME_RATE, MOVEMENT_RANGE, GRID_WIDTH } from '@legion/shared/config';
import { hexDistance, listCellsOnTheWay } from '@legion/shared/utils';
import {loadGameSettings} from '../settings';
import {VFX_DISPLAY_SCALE} from './VFXconfig';
import {SPELL_SLOT_OFFSET} from '../input/bindings';
import {displayTint} from './palette';
import {FEEDBACK, flash, hitStop, popNumber, rumble, screenEffectsEnabled, shake} from './feedback';

/** Knocked-out characters stay on the field, dimmed. */
const DEAD_TINT = 0x7a7480;
const STEP_MS = 110;

export const NUMBER_COLORS = {
    damage: '#ffe6c7', heavy: '#ff6a4a', heal: '#7dee8f', mana: '#7cc6ff', poison: '#c08cff', burn: '#ffa04d',
};

const STATUS_COLORS: Partial<Record<StatusEffect, number>> = {
    [StatusEffect.POISON]: 0xa66bff, [StatusEffect.BURN]: 0xff7a2e, [StatusEffect.FREEZE]: 0x8fd8ff,
    [StatusEffect.PARALYZE]: 0xffe066, [StatusEffect.SLEEP]: 0x9fb4ff, [StatusEffect.MUTE]: 0xd2c8e0,
    [StatusEffect.HASTE]: 0x7dffb0,
};

enum GlowColors {
    Enemy = 0xff0000,
    Ally = 0x00ff00,
    Selected = 0xffffff,
}

export class Player extends Phaser.GameObjects.Container {
    sprite: Phaser.GameObjects.Sprite;
    numKey: Phaser.GameObjects.Text;
    selectionOval: Phaser.GameObjects.Graphics;
    glowFx: Phaser.FX.Glow;
    private hovered = false;
    private targetHighlighted = false;
    private itemPreviewed = false;
    name = 'Player 1';
    isPlayer = false;
    texture: string;
    arena: Arena;
    gridX: number;
    gridY: number;
    num: number;
    distance: number;
    baseSquare: Phaser.GameObjects.Graphics;
    combatStats?: CharacterStats;
    maxHP: number;
    maxMP: number;
    hp: number;
    mp: number;
    healthBar: HealthBar;
    MPBar: HealthBar;
    inventory: BaseItem[] = [];
    spells: BaseSpell[] = [];
    animationSprite: Phaser.GameObjects.Sprite;
    statusSprites: Map<StatusEffect, Phaser.GameObjects.Sprite>;
    pendingSpell: number | null = null;
    pendingItem: number | null = null;
    casting = false;
    selected = false;
    HURT_THRESHOLD = 0.5;
    team: Team;
    animationLock = false;
    statuses: StatusEffects;
    /** When each status last gained turns, so the HUD can pulse its counter. */
    statusRefreshes: Partial<Record<StatusEffect, number>> = {};
    class: Class;
    xp: number;
    level: number;
    lastOverheadMessage: number;
    speechBubble: SpeechBubble;
    normalColor: number;
    goldenColor: number = 0xDAA520;
    blinkTween: Phaser.Tweens.Tween | null = null;
    selectionArrow: Phaser.GameObjects.Sprite;
    deathCheckTimer: Phaser.Time.TimerEvent;
    chargeSprite: Phaser.GameObjects.Sprite | null = null;
    diedAt = 0;
    /** An HP change waiting briefly in case a melee attack claims it, so the hit lands with the blow. */
    pendingReaction: {delta: number; timer: Phaser.Time.TimerEvent} | null = null;
    private offsetTween: Phaser.Tweens.BaseTween | null = null;
    private chargeAura: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

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
        this.distance = MOVEMENT_RANGE;
        this.maxHP = maxHP;
        this.maxMP = maxMP;
        this.hp = this.maxHP;
        this.mp = this.maxMP;
        this.num = num;
        this.class = characterClass;
        this.xp = xp;
        this.level = level;

        this.normalColor = isPlayer ? 0x0000ff : 0xff0000;
        // this.baseSquare = scene.add.graphics().setAlpha(BASE_SQUARE_ALPHA);
        // this.setBaseSquareColor(this.normalColor); // Use method to set color
        // this.add(this.baseSquare);

        // Create the sprite using the given key and add it to the container
        this.sprite = scene.add.sprite(0, 0, texture);

        this.add(this.sprite);

        this.healthBar = new HealthBar(scene, 0, -50, 0x00ff08);
        this.add(this.healthBar);
        this.setHP(hp);

        // Older snapshots/replays omit enemy mana; do not invent a bar for them.
        if (Number.isFinite(mp) && Number.isFinite(maxMP) && maxMP > 0) {
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
            this.numKey = scene.add.text(30, 70, num.toString(), { fontFamily: fontFamily(), fontSize: 12 * loadGameSettings().textSize / 100, color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1,1);
            this.add(this.numKey);
        }

        // this.baseSquare.fillStyle(isPlayer ? 0x0000ff : 0xff0000); // Must be called before strokeRect
        // this.baseSquare.fillRoundedRect(-30, 10, 60, 60, BASE_SQUARE_RADIUS);

        if (gridX < GRID_WIDTH/2) this.sprite.flipX = true;

        // @ts-expect-error
        this.scene.sprites.push(this.sprite);

        this.glowFx = this.sprite.preFX.addGlow(0x000000, 6);
        this.glowFx.setActive(false);

        // Add the container to the scene
        scene.add.existing(this);
        this.updatePos(gridX, gridY);

        this.playAnim('idle');
        this.sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 64 });
        this.sprite.on('pointerover', () => this.arena.inspectBattlefieldCharacter(this));
        this.sprite.on('pointerout', () => this.arena.clearBattlefieldCharacter(this));
        this.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.rightButtonDown()) this.arena.handleTileClick(this.gridX, this.gridY);
        });

        this.speechBubble = new SpeechBubble(this.scene, -15, (this.height / 2) - 10, '').setVisible(false);
        this.add(this.speechBubble);

        this.displayBars();

        // Add death check timer
        this.deathCheckTimer = this.scene.time.addEvent({
            delay: 500,
            callback: this.checkDeathAnimation,
            callbackScope: this,
            loop: true
        });
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
            // @ts-expect-error
            this.scene.sprites.push(sprite);
        });
    }

    // Returns the fields needed to display the top screen Player box in-game.
    // For the fields needed for the team overviews on each side, see Team.ts:getOverview()
    getProps(): PlayerProps {
        return {
            name: this.name,
            number: this.num,
            team: this.team.id,
            portrait: this.texture,
            hp: this.hp,
            maxHp: this.maxHP,
            mp: this.mp,
            maxMp: this.maxMP,
            spells: this.spells,
            items: this.inventory,
            casting: this.casting,
            statuses: this.statuses,
            statusRefreshes: this.statusRefreshes,
            pendingSpell: this.pendingSpell,
            pendingItem: this.pendingItem,
            isParalyzed: this.isParalyzed(),
            isPlayer: this.isPlayer,
          }
    }

    makeAirEntrance(onEntered?: () => void) {
        // this.baseSquare.setVisible(false);
        const {x: targetX, y: targetY} = this.arena.hexGridToPixelCoords(this.gridX, this.gridY);

        // Create a trail effect
        const trailSprites: Phaser.GameObjects.Sprite[] = [];
        const trailInterval = 50; // Interval between trail sprites in ms
        const trailDuration = 400; // Duration for which each trail sprite is visible

        const createTrail = () => {
            const trailSprite = this.scene.add.sprite(this.x, this.y, this.texture)
                .setAlpha(0.5)
                .setScale(this.sprite.scaleX, this.sprite.scaleY)
                .setDepth(this.sprite.depth - 1) // Ensure trail is behind the main sprite
                .setFlipX(this.sprite.flipX);

            trailSprites.push(trailSprite);

            this.scene.tweens.add({
                targets: trailSprite,
                alpha: 0,
                duration: trailDuration,
                onComplete: () => {
                    trailSprite.destroy();
                }
            });
        };

        // Tween for the dramatic landing
        this.scene.tweens.add({
            targets: this,
            y: targetY,
            duration: 400,
            onStart: () => {
                this.playAnim('hurt');
                this.scene.time.addEvent({
                    delay: trailInterval,
                    callback: createTrail,
                    callbackScope: this,
                    repeat: Math.floor(400 / trailInterval) - 1 // Create trails throughout the fall
                });
            },
            onComplete: () => {
                // Play the 'thud' sound effect
                this.arena.playSound('thud');

                // Create a smoke effect on landing
                const smokeSprite = this.scene.add.sprite(targetX, targetY + 15, '')
                    .setDepth(this.sprite.depth + 1)
                    .setScale(2);

                smokeSprite.play('smoke');

                // Destroy the smoke sprite after the animation completes
                smokeSprite.on('animationcomplete', () => {
                    smokeSprite.destroy();
                });

                // Camera shake effect
                this.scene.cameras.main.shake(200, 0.005);
                // this.baseSquare.setVisible(true);

                // Revert to idle animation after a short delay
                this.scene.time.delayedCall(300, () => {
                    this.playAnim('boast', true);
                    if (onEntered) this.sprite.once('animationcomplete', onEntered);
                    this.arena.relayEvent('characterAdded');
                });
            }
        });
    }

    makeEntrance() {
        const callback = () => {
            this.playAnim('boast', true);
        };
        this.walkTo(this.gridX, this.gridY, 2000, callback);
    }

    isAlive() {
        return this.hp > 0;
    }

    isFrozen() {
        if (!this.statuses) return false;
        return this.statuses[StatusEffect.FREEZE] !== 0;
    }

    isParalyzed() {
        return (this.statuses[StatusEffect.PARALYZE] !== 0) || this.isFrozen();
    }

    isMuted() {
        return this.statuses[StatusEffect.MUTE] !== 0;
    }

    isHasted() {
        if (!this.statuses) return false;
        return this.statuses[StatusEffect.HASTE] !== 0;
    }

    canAct() {
        return this.isAlive() && !this.casting && !this.isParalyzed();
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
        this.sprite.anims?.stop();

        if (this.isFrozen()) {
            this.animationLock = false;
            return;
        }

        // Check if there is another player on the cell above
        // if (this.arena.hasPlayer(this.gridX, this.gridY - 1)) {
        //     if (key == 'idle') key = 'hurt';
        // }

        // Retrieve the animation by its key
        const animation = this.scene.anims?.get(`${this.texture}_anim_${key}`);
        const frameRate = animation ? animation.frameRate : BASE_ANIM_FRAME_RATE;

        // Play the animation with the retrieved frame rate
        this.sprite.play({
            key: `${this.texture}_anim_${key}`,
            frameRate: this.isHasted() ? frameRate * 1.5 : frameRate,
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
        this.refreshHighlight(true);

        if (this.isPlayer) {
            this.displayMovementRange();
            this.decrementStatuses();
            this.selected = true;

            this.checkHeartbeat();

        }
    }

    deselect() {
        this.selectionOval?.setVisible(false);
        if (this.selectionArrow) {
            this.selectionArrow.setVisible(false);
        }
        this.hideMovementRange();
        this.selected = false;
        this.refreshHighlight(false);
        this.pendingSpell = null;
        this.pendingItem = null;
    }

    isSelected() {
        return this.selected;
    }

    decrementStatuses() {
        for(const status in this.statuses) {
            if (this.statuses[status] > 0) {
                this.statuses[status]--;
            }
        }
    }

    displayMovementRange() {
        if (!this.canAct()) return;
        if (this.pendingSpell != null) return;
        this.arena.highlightCells(this.gridX, this.gridY, this.distance);
    }

    hideMovementRange() {
        this.arena.hexGridManager.clearHighlight();
    }

    canMoveTo(x: number, y: number) {
        if (!this.canAct()) return false;

        const distance = hexDistance(this.gridX, this.gridY, x, y);
        // console.log(`[Player:canMoveTo] distance: ${distance}, distance: ${this.distance}`);
        return distance <= this.distance;
    }

    updatePos(x, y) {
        this.arena.clearBattlefieldCharacter(this);
        this.gridX = x;
        this.gridY = y;
        this.setDepth(this.arena.yToZ(y));
    }

    onPointerOver() {
        if (this.isTarget() && this.arena.selectedPlayer?.pendingSpell == null) {
            this.arena.relayEvent('hoverEnemyCharacter');
        } else if (this.isPlayer){
            this.arena.relayEvent('hoverCharacter');
        }
    }

    onPointerOut() {
        this.arena.relayEvent('unhoverCharacter');
    }

    setHovered(hovered: boolean) {
        this.hovered = hovered;
        this.refreshHighlight();
    }

    /** A hovered consumable in the dock would affect this character. */
    setItemPreviewed(previewed: boolean) {
        this.itemPreviewed = previewed;
        this.refreshHighlight();
    }

    setTargetHighlighted(highlighted: boolean) {
        this.targetHighlighted = highlighted;
        this.refreshHighlight();
    }

    private refreshHighlight(selected = this.arena.selectedPlayer === this) {
        this.glowFx.color = this.itemPreviewed ? displayTint(GlowColors.Ally)
            : this.hovered ? 0xffd785 : selected ? GlowColors.Selected : displayTint(this.isPlayer ? GlowColors.Ally : GlowColors.Enemy);
        this.glowFx.setActive(this.itemPreviewed || this.hovered || this.targetHighlighted || selected);
    }

    onPointerDown() {
        const selectedPlayer = this.arena.selectedPlayer;
        if (selectedPlayer) {
            if (selectedPlayer === this) return; // Might be a move up order
            if (selectedPlayer.hasPendingSpell() || selectedPlayer.hasPendingItem()) return; // Spell cast or item use should be tile-based
            if (!this.isNextTo(selectedPlayer.gridX, selectedPlayer.gridY)) return;
        }
        this.arena.handleTileClick(this.gridX, this.gridY);
        this.arena.lockInput();
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
        if(this.isTarget()) {
            this.arena.playSound('click');
            this.arena.sendAttack(this);
        }
    }

    getSpellsIndex() {
        return SPELL_SLOT_OFFSET;
    }

    onKey(keyIndex) {
        if (!this.isPlayer || this.arena.turnee?.team !== this.team.id || this.arena.turnee?.num !== this.num) return;
        this.arena.playSound('click');
        const spellsIndex = this.getSpellsIndex();
        if (keyIndex >= spellsIndex) {
            this.useSkill(keyIndex - spellsIndex);
        } else {
            this.useItem(keyIndex);
        }
    }

    getItemAtSlot(index): BaseItem | null {
        if (index >= this.inventory.length) return null;
        return this.inventory[index];
    }

    useItem(index) {
        // console.log(`[Player:useItem] index: ${index}`);
        if (this.pendingItem === index) {
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
        // console.log(`[Player:useItem] item: ${item.name}`);
        const unavailable = this.arena.unavailableActionReason(this);
        if (unavailable) {
            this.arena.actionFeedback(unavailable);
            this.arena.playSound('nope');
            return;
        }
        if (item) {
            if (item.target === Target.SELF) {
                if (this.arena.showItemNoEffect(item, this)) return;
                this.arena.sendUseItem(index, this.x, this.y, this);
            } else {
                this.pendingItem = index;
                this.arena.toggleItemMode(true);
                this.arena.refreshBox();
            }
        }
    }

    useItemAnimation(animation: string, name: string) {
        this.playAnim('item', true);
        this.playSuperimposedAnim(animation);
        this.displayOverheadText(t(name), 4000, '#fff');
    }

    castAnimation(flag: boolean, name: string, charge?: string) {
        if (flag) {
            this.playAnim('cast', false);
            this.animationSprite.setVisible(true).play('cast');
            this.displayOverheadText(t(name), 4000, '#fff');
            this.arena.playSound('cast');

            if (charge) {
                // Create charge sprite above the player
                this.chargeSprite = this.scene.add.sprite(
                    0, // Center on player
                    -50, // Position above the player
                    ''
                )
                .setDepth(1) // Set slightly higher depth than player
                .setScale(0.5 * VFX_DISPLAY_SCALE);

                // Add the chargeSprite to the player container
                this.add(this.chargeSprite);

                // Play the fire charge animation
                this.chargeSprite.play(charge);
                this.chargeAura?.destroy();
                this.chargeAura = this.arena.chargeAura(this, charge);
            }
        } else {
            // Stop and clean up charge animation when ending cast
            if (this.chargeSprite) {
                this.chargeSprite.stop();
                this.chargeSprite.setVisible(false);
                this.chargeSprite.destroy();
                this.chargeSprite = null;
            }
            this.chargeAura?.destroy();
            this.chargeAura = null;

            this.playAnim('idle');
            this.animationSprite.setVisible(false);
            this.arena.stopSound('cast');
        }
        this.casting = flag;
    }

    cancelSkill() {
        this.pendingSpell = null;
        this.arena.toggleTargetMode(false);
        this.arena.refreshBox();
    }

    cancelItem() {
        this.pendingItem = null;
        this.arena.toggleItemMode(false);
        this.arena.refreshBox();
    }

    useSkill(index) {
        const spell = this.spells[index];
        if (!spell) {
            return;
        }

        // If the same spell is selected again, cancel it
        if (this.pendingSpell === index) {
            this.cancelSkill();
            return;
        }

        // Cancel any pending item
        if (this.pendingItem != null) {
            this.cancelItem();
        }

        // Give the same feedback for mouse, keyboard, and controller actions.
        const unavailable = this.arena.unavailableActionReason(this);
        if (unavailable || spell.cost > this.mp || this.isMuted()) {
            this.arena.actionFeedback(unavailable || (this.isMuted()
                ? t("Silenced: choose another action.")
                : t("Not enough mana: needs {{cost}} MP, you have {{mp}}.", {cost: spell.cost, mp: this.mp})));
            this.arena.playSound('nope');
            return;
        }

        // Set the pending spell and enable target mode
        this.pendingSpell = index;
        this.arena.toggleTargetMode(true);
        this.arena.refreshBox();
        this.arena.relayEvent(`selectedSpell_${spell.id}`);
    }

    isTarget() {
        return (!this.isPlayer || this.isInIce())
            && this.isAlive()
            // && this.arena.selectedPlayer?.isNextTo(this.gridX, this.gridY)
    }

    isNextTo(x: number, y: number) {
        return hexDistance(this.gridX, this.gridY, x, y) <= 1;
    }

    walkTo(gridX: number, gridY: number, duration?: number, callback?: () => void) {
        const oldGridX = this.gridX;
        const oldGridY = this.gridY;

        // Update grid position - this changes the character's logical position
        this.updatePos(gridX, gridY);
        this.playAnim('walk');
        this.arena.hexGridManager.updateTileOnCharacterExit(oldGridX, oldGridY);

        const finish = () => {
            this.arena.hexGridManager.updateTileOnCharacterEnter(gridX, gridY, this.isPlayer);
            if (callback) callback();
            else this.playAnim('idle');
        };

        // Step through each hex of the straight line a move follows, with a puff of dust per step.
        const cells = duration ? [{x: gridX, y: gridY}]
            : [...listCellsOnTheWay(oldGridX, oldGridY, gridX, gridY)].map(cell => {
                const [x, y] = cell.split(',').map(Number);
                return {x, y};
            });
        const stepMs = duration ?? Math.min(STEP_MS, 450 / cells.length);
        this.scene.tweens.chain({
            targets: this,
            tweens: cells.map((cell, index) => ({
                ...this.arena.hexGridToPixelCoords(cell.x, cell.y),
                duration: stepMs,
                ease: index === cells.length - 1 ? 'Quad.easeOut' : 'Linear',
                onComplete: () => this.arena.dustPuff(this.x, this.y + 40, this.depth - 0.001),
            })),
            onComplete: () => {
                this.landingSquash();
                finish();
            },
        });

        // Flip sprite if moving horizontally
        if (oldGridX !== this.gridX) this.sprite.flipX = this.gridX > oldGridX;
    }

    private landingSquash() {
        if (!screenEffectsEnabled()) return;
        this.scene.tweens.add({targets: this.sprite, scaleY: 0.92, scaleX: 1.06, duration: 70, yoyo: true, ease: 'Quad.easeOut',
            onComplete: () => this.sprite.setScale(1)});
    }

    setHP(hp) {
        const _hp = this.hp
        this.hp = hp;
        this.healthBar.setHpValue(hp / this.maxHP);

        if(this.isSelected()) this.checkHeartbeat();

        if (this.hp <= 0) {
            if (_hp > 0) this.diedAt = Date.now();
            this.die();
            if (_hp > 0) this.arena.onCharacterDown(this);
        } else {
            if (_hp <= 0) {
                this.restoreTint();
                this.arena.onCharacterUp();
            }
            if (!this.casting) this.playAnim('hurt', true);

            this.displayBars();
        }

        if(this.hp !== _hp) {
            this.arena.refreshUI(this.num);
            this.team.updateHP();
        }
    }

    /** Hand back a waiting HP reaction so a melee attack can play it at the moment of impact. */
    takePendingReaction(): number | null {
        const pending = this.pendingReaction;
        if (!pending) return null;
        pending.timer.remove();
        this.pendingReaction = null;
        return pending.delta;
    }

    /**
     * The visible side of an HP change: a number, and for damage a flash, knockback, impact freeze,
     * shake and sparks scaled by the share of max HP lost. `from` is where the blow came from.
     */
    showHPChange(delta: number, {from, color}: {from?: {x: number; y: number}; color?: string} = {}) {
        if (!delta || !this.scene) return;
        const share = Math.min(1, Math.abs(delta) / this.maxHP);
        const y = (-this.sprite.height / 2) + 15;
        const fontSize = 24 * loadGameSettings().textSize / 100;
        if (delta > 0) {
            popNumber(this.scene, this, y, `+${Math.round(delta)}`, color ?? NUMBER_COLORS.heal, 1 + share * 0.6, fontSize);
            return;
        }
        const kill = this.hp <= 0;
        const heavy = share >= 0.25 || kill;
        popNumber(this.scene, this, y, `${Math.round(delta)}`, color ?? (heavy ? NUMBER_COLORS.heavy : NUMBER_COLORS.damage),
            1 + Math.min(share, 0.5) * 1.4, fontSize);
        flash(this.scene, this.sprite, () => this.restoreTint(), color ? Phaser.Display.Color.HexStringToColor(color).color : 0xffffff);
        this.knockback(from);
        hitStop(this.scene, FEEDBACK.hitStopMs(share, kill));
        const {duration, intensity} = FEEDBACK.shake(share, kill);
        shake(this.scene, duration, intensity);
        this.arena.sparks(this.x, this.y - 10, kill ? 18 : Math.round(5 + share * 20));
        if (kill) {
            this.deathFlourish();
            rumble(0.6, 0.5, 220);
        } else if (this.isPlayer) {
            rumble(0.2 + share * 0.6, 0.3, 120);
        }
    }

    showMPGain(delta: number) {
        if (delta <= 0 || !this.scene) return;
        popNumber(this.scene, this, (-this.sprite.height / 2) + 15, `+${Math.round(delta)}`, NUMBER_COLORS.mana, 1,
            24 * loadGameSettings().textSize / 100);
    }

    /** Shove the sprite away from the blow and let it settle back. */
    private knockback(from?: {x: number; y: number}) {
        if (!screenEffectsEnabled()) return;
        this.resetOffset();
        if (!from) {
            this.offsetTween = this.scene.tweens.add({targets: this.sprite, scaleY: 0.9, duration: 60, yoyo: true,
                onComplete: () => this.sprite.setScale(1)});
            return;
        }
        const angle = Math.atan2(this.y - from.y, this.x - from.x);
        const distance = FEEDBACK.knockbackDistance;
        this.offsetTween = this.scene.tweens.chain({targets: this.sprite, tweens: [
            {x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.5, duration: 60, ease: 'Quad.easeOut'},
            {x: 0, y: 0, duration: 220, ease: 'Quad.easeInOut'},
        ]});
    }

    /** Wind up, lunge at the target and call `onImpact` as the blow lands. */
    lunge(target: {x: number; y: number}, onImpact: () => void) {
        if (!screenEffectsEnabled()) {
            onImpact();
            return;
        }
        this.resetOffset();
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const dx = Math.cos(angle), dy = Math.sin(angle) * 0.5;
        this.offsetTween = this.scene.tweens.chain({targets: this.sprite, tweens: [
            {x: -dx * 4, y: -dy * 4, duration: FEEDBACK.windUpMs, ease: 'Quad.easeOut'},
            {x: dx * FEEDBACK.lungeDistance, y: dy * FEEDBACK.lungeDistance, duration: FEEDBACK.lungeMs, ease: 'Quad.easeIn',
                onComplete: onImpact},
            {x: 0, y: 0, duration: 180, ease: 'Quad.easeOut'},
        ]});
    }

    private resetOffset() {
        this.offsetTween?.stop();
        this.offsetTween = null;
        this.sprite.setPosition(0, 0).setScale(1);
    }

    /** Collapse, embers drifting up, then the body dims. */
    private deathFlourish() {
        this.arena.embers(this.x, this.y - 10, 16);
        if (!screenEffectsEnabled()) return;
        this.scene.tweens.add({targets: this.sprite, scaleY: 0.82, scaleX: 1.1, duration: 110, yoyo: true, ease: 'Quad.easeOut',
            onComplete: () => this.sprite.setScale(1)});
    }

    /** Clear temporary tints, keeping a knocked-out character dimmed. */
    restoreTint() {
        if (!this.sprite?.active) return;
        if (this.isAlive()) {
            this.sprite.clearTint();
            this.sprite.setAlpha(1);
        } else {
            this.sprite.setTint(DEAD_TINT);
            this.sprite.setAlpha(0.85);
        }
    }

    /** A coloured glow over the character when a status takes hold. */
    private statusPulse(color: number) {
        if (!screenEffectsEnabled()) return;
        const from = Phaser.Display.Color.ValueToColor(0xffffff);
        const to = Phaser.Display.Color.ValueToColor(color);
        this.scene.tweens.addCounter({from: 0, to: 100, duration: 180, yoyo: true, repeat: 1,
            onUpdate: tween => {
                const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tween.getValue());
                this.sprite.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
            },
            onComplete: () => this.restoreTint(),
        });
    }

    getHPpct() {
        return this.hp / this.maxHP;
    }

    setMP(mp) {
        const _mp = this.mp
        this.mp = mp;
        this.MPBar?.setHpValue(mp / this.maxMP);

        if(this.mp !== _mp) {
            this.arena.refreshUI(this.num);
        }
        return _mp;
    }

    die() {
        if (this.arena.hoveredPlayer === this) this.arena.clearCharacterHover();
        this.healthBar.setVisible(false);
        this.MPBar?.setVisible(false);
        this.hideAllStatusAnimations();
        this.playAnim('die');
        // Dim once the fall has played.
        this.scene.time.delayedCall(450, () => this.restoreTint());
        // this.hideBaseSquare();
        // this.stopBlinkingBaseSquare(); // Stop blinking if any
        if (this.arena.selectedPlayer === this) this.arena.deselectPlayer();

        this.arena.relayEvent('characterKilled');
    }

    attack(targetX: number) {
        this.playAnim('attack', true);
        this.sprite.flipX = targetX > this.gridX;
    }

    displayOverheadText(text, duration, color) {
        const randomXOffset = 0; //(Math.random() - 0.5) * 30;
        let randomYOffset = 0; // (Math.random() - 0.5) * 10;

        if (Date.now() - this.lastOverheadMessage < 100) {
            randomYOffset -= 30;
        }

        const textObject = this.scene.add.text(
            randomXOffset,( -this.sprite.height / 2) + 15 + randomYOffset, `${String(text)}`,
            { fontSize: 24 * loadGameSettings().textSize / 100, color, stroke: '#000', strokeThickness: 3, fontFamily: fontFamily(),}
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
        this.displayBars();
    }

    victoryDance() {
        if (this.isAlive()) this.playAnim('victory');
    }

    setStatuses(statuses: StatusEffects) {
        Object.keys(statuses).forEach(status => {
            const duration = statuses[status];
            const previous = this.statuses[status];
            if (previous && duration && (duration === -1 ? previous !== -1 : previous !== -1 && duration > previous)) {
                this.statusRefreshes[status] = Date.now();
            }
            this.statuses[status] = duration;
            if (duration !== 0 && !previous) this.onStatusGained(status as StatusEffect);
            else if (!duration && previous && this.isAlive()) this.arena.dustPuff(this.x, this.y - 40, this.depth + 0.001, 0.6);
            if (duration !== 0) {
                this.showStatusAnimation(status as keyof StatusEffects);
                this.arena.relayEvent(`statusGained_${status}`);
            } else {
                this.hideStatusAnimation(status as keyof StatusEffects);
            }
        });

        // Compute if any of the paralyzing statuses are active
        const paralyzing = paralyzingStatuses.some(status => statuses[status] != null && statuses[status] !== 0);
        this.toggleCharacterImmobilization(paralyzing);

        this.arena.refreshUI(this.num);
    }

    private onStatusGained(status: StatusEffect) {
        const color = STATUS_COLORS[status];
        if (color) {
            this.statusPulse(color);
            this.arena.sparks(this.x, this.y - 30, 8, color);
        }
        const sprite = this.statusSprites.get(status);
        if (sprite && screenEffectsEnabled()) {
            sprite.setScale(0);
            this.scene.tweens.add({targets: sprite, scale: 1, duration: 320, ease: 'Back.easeOut'});
        }
    }

    showStatusAnimation(status: StatusEffect) {
        const keys = {
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
        } else {
            this.playAnim(this.getIdleAnim());
        }
    }

    async talk(text: string, sticky = false) {
        if (!this.speechBubble) return;
        if (this.speechBubble.visible && this.speechBubble.getText() === text) return;
        if (this.speechBubble.visible) {
            this.hideBubble();
        }

        // await this.scene?.sleep(10);
        this.speechBubble.setText(t(text));
        this.speechBubble.setVisible(true);
        const duration = this.speechBubble.setDuration(sticky);
        return duration;
    }


    hideBubble() {
        this.speechBubble.setVisible(false);
    }

    displayBars() {
        this.healthBar.setVisible(this.isAlive());
        this.MPBar?.setVisible(this.hasSpells() && this.isAlive());
    }

    hasSpells() {
        return this.spells.length > 0;
    }

    revealHealthBar() {
        this.healthBar.setVisible(true);
    }

    revealMPBar() {
        this.MPBar?.setVisible(true);
    }

    hasItems() {
        return this.inventory.length > 0;
    }

    hasUsableItem() {
        // Iterate over items, retun true if at least one replenishes HP and the character's
        // HP is less than maxHP, same for MP
        return this.inventory.some(item => {
            return item.target === Target.SELF
            && (
                item.effects.some(effect => effect.stat === Stat.HP && effect.value > 0 && this.hp < this.maxHP)
                || item.effects.some(effect => effect.stat === Stat.MP && effect.value > 0 && this.mp < this.maxMP)
            );
        });
    }

    checkDeathAnimation() {
        if (!this.isAlive() && (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== `${this.texture}_anim_die`)) {
            this.playAnim('die');
        }
    }

    destroy() {
        if (!this.scene) return;
        if (this.arena.hoveredPlayer === this) this.arena.clearCharacterHover();
        this.chargeAura?.destroy();
        this.chargeAura = null;
        this.pendingReaction?.timer.remove();
        this.pendingReaction = null;
        // Cleanup charge sprite if it exists
        if (this.chargeSprite) {
            this.chargeSprite.destroy();
            this.chargeSprite = null;
        }

        // Stop all tweens related to this player
        if (this.scene?.tweens) {
            this.scene.tweens.killTweensOf(this);
            this.scene.tweens.killTweensOf(this.sprite);
            // this.scene.tweens.killTweensOf(this.baseSquare);
        }

        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }

        // Stop any ongoing animations
        this.sprite.anims?.stop();
        this.animationSprite.anims?.stop();

        if (this.selectionArrow) {
            this.scene.tweens.killTweensOf(this.selectionArrow);
        }

        // Stop the death check timer
        if (this.deathCheckTimer) {
            this.deathCheckTimer.destroy();
        }

        // Call the parent class's destroy method
        super.destroy();
      }
}
