// Combat feedback shared by the arena and its characters: impact freezes, flashes, camera shake,
// controller rumble and floating numbers. All timings live here so they can be tuned together.
import {loadGameSettings} from '../settings';
import {fontFamily} from '../i18n/core';

export const FEEDBACK = {
    /** Attacker wind-up, then the lunge that lands the blow. */
    windUpMs: 60,
    lungeMs: 70,
    lungeDistance: 12,
    knockbackDistance: 8,
    flashMs: 80,
    /** Hit-stop grows with the share of max HP lost. */
    hitStopMs: (share: number, kill: boolean) => kill ? 120 : Math.min(100, 45 + share * 90),
    shake: (share: number, kill: boolean) => kill
        ? {duration: 280, intensity: 0.01}
        : {duration: Math.min(220, 90 + share * 200), intensity: Math.min(0.008, 0.0015 + share * 0.012)},
    numberLifetimeMs: 900,
};

const reducedMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Shake, flashes, freezes and knockback: off when the player disables them or the system asks for reduced motion. */
export const screenEffectsEnabled = () => loadGameSettings().screenEffects && !reducedMotion?.matches;

const stops = new WeakMap<Phaser.Scene, {until: number; timer: ReturnType<typeof setTimeout>}>();

/** Freeze tweens and sprite animations for a moment so a hit lands. Overlapping stops merge. */
export function hitStop(scene: Phaser.Scene, ms: number) {
    if (ms <= 0 || !screenEffectsEnabled()) return;
    const until = performance.now() + ms;
    const current = stops.get(scene);
    if (current && current.until >= until) return;
    if (current) clearTimeout(current.timer);
    else {
        scene.tweens.pauseAll();
        scene.anims.pauseAll();
    }
    stops.set(scene, {until, timer: setTimeout(() => {
        stops.delete(scene);
        if (!scene.sys?.isActive()) return;
        scene.tweens.resumeAll();
        scene.anims.resumeAll();
    }, ms)});
}

/** Fill a sprite with a solid colour briefly, then hand control back to `restore`. */
export function flash(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, restore: () => void, color = 0xffffff, ms = FEEDBACK.flashMs) {
    if (!screenEffectsEnabled()) return;
    sprite.setTintFill(color);
    scene.time.delayedCall(ms, () => { if (sprite.active) restore(); });
}

/** Camera shake; a weaker request never cuts a stronger shake short. */
export function shake(scene: Phaser.Scene, duration: number, intensity: number) {
    if (!screenEffectsEnabled()) return;
    const camera = scene.cameras.main;
    const effect = camera.shakeEffect as Phaser.Cameras.Scene2D.Effects.Shake & {intensity: Phaser.Math.Vector2};
    if (effect.isRunning && effect.intensity.x >= intensity) return;
    camera.shake(duration, intensity, true);
}

type RumblePad = Gamepad & {vibrationActuator?: {playEffect: (type: string, params: object) => Promise<unknown>}};

/** Rumble every connected controller that supports it. Magnitudes are 0–1. */
export function rumble(strong: number, weak: number, ms: number) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    for (const pad of navigator.getGamepads() as (RumblePad | null)[]) {
        pad?.vibrationActuator?.playEffect('dual-rumble', {duration: ms, strongMagnitude: strong, weakMagnitude: weak})
            .catch(() => undefined);
    }
}

/**
 * A number that pops in over a character, rises and fades. `scale` grows with the size of the
 * change, so a big hit reads as big at a glance.
 */
export function popNumber(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number, text: string,
    color: string, scale = 1, fontSize = 24) {
    const label = scene.add.text((Math.random() - 0.5) * 30, y, text, {
        fontSize, color, stroke: '#1b0f0a', strokeThickness: 4, fontFamily: fontFamily(), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
    parent.add(label);
    const motion = screenEffectsEnabled();
    label.setScale(motion ? scale * 1.6 : scale);
    if (motion) scene.tweens.add({targets: label, scale, duration: 120, ease: 'Back.easeOut'});
    scene.tweens.add({
        targets: label,
        y: y - 36,
        alpha: 0,
        delay: 300,
        duration: FEEDBACK.numberLifetimeMs - 300,
        ease: 'Cubic.easeIn',
        onComplete: () => label.destroy(),
    });
    return label;
}
