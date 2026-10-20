import type {Arena} from './Arena';
import {FEEDBACK, screenEffectsEnabled} from './feedback';

/** Break the intact first melt frame into textured shards, on the melee impact beat. */
export function shatterIce(scene: Arena, ice: Phaser.GameObjects.Sprite) {
    const motion = screenEffectsEnabled();
    const burst = () => {
        if (!ice.active) return;
        scene.playSound('shatter');
        if (!motion) {
            scene.tweens.add({targets: ice, alpha: 0, duration: 120, onComplete: () => ice.destroy()});
            return;
        }
        const frame = scene.textures.getFrame('meltdown', 0);
        const size = frame.width / 3;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                for (let half = 0; half < 2; half++) {
                    const key = `ice_shard_${row}_${col}_${half}`;
                    if (!scene.textures.exists(key)) {
                        const texture = scene.textures.createCanvas(key, size, size)!;
                        const context = texture.context;
                        context.beginPath();
                        context.moveTo(size, 0);
                        context.lineTo(half ? size : 0, half ? size : 0);
                        context.lineTo(0, size);
                        context.closePath();
                        context.clip();
                        context.drawImage(frame.source.image as HTMLImageElement,
                            frame.cutX + col * size, frame.cutY + row * size, size, size, 0, 0, size, size);
                        texture.refresh();
                    }
                    const x = ice.x + ((col + 0.5) * size - ice.originX * frame.width) * ice.scaleX;
                    const y = ice.y + ((row + 0.5) * size - ice.originY * frame.height) * ice.scaleY;
                    const shard = scene.add.image(x, y, key).setDepth(ice.depth + 0.01)
                        .setScale(ice.scaleX, ice.scaleY).setAlpha(ice.alpha);
                    const vx = ((col - 1) * 75 + Phaser.Math.Between(-45, 45)) * ice.scaleX;
                    const vy = Phaser.Math.Between(-180, -90) * ice.scaleY;
                    const gravity = 190 * ice.scaleY;
                    const spin = Phaser.Math.Between(-140, 140);
                    const alpha = ice.alpha;
                    scene.tweens.addCounter({from: 0, to: 1, duration: Phaser.Math.Between(420, 600),
                        onUpdate: tween => {
                            const t = tween.getValue() ?? 0;
                            shard.setPosition(x + vx * t, y + vy * t + gravity * t * t)
                                .setAngle(spin * t).setAlpha(alpha * (1 - t * t));
                        },
                        onComplete: () => shard.destroy(),
                    });
                }
            }
        }
        ice.destroy();
    };
    // Terrain arrives just before the attack. Use the lunge's tween clock so hit-stop
    // and kill-cam slow motion keep the break aligned with the blow.
    if (motion) scene.tweens.addCounter({duration: FEEDBACK.windUpMs + FEEDBACK.lungeMs, onComplete: burst});
    else burst();
}
