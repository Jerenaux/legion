import RoundRectangle from 'phaser3-rex-plugins/plugins/roundrectangle.js';
import { DARKENING_INTENSITY } from './Arena';

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly barBackground: RoundRectangle;
  private readonly hpBar: RoundRectangle;
  /** What was just lost: stays lit, then drains after the hit. */
  private readonly trailBar: RoundRectangle;
  /** Predicted loss from the hovered action, blinking on top of the bar. */
  private readonly previewBar: RoundRectangle;
  private trailTween: Phaser.Tweens.Tween | null = null;
  private previewTween: Phaser.Tweens.Tween | null = null;
  /** Shown above the bar when the hovered action would knock the target out. */
  private skull: Phaser.GameObjects.Container | null = null;
  private readonly barOutline: RoundRectangle;
  private hpValue: number;
  private originalColor: number;
  private originalBgColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    super(scene, x, y);

    this.originalColor = color;
    this.originalBgColor = 0xa31720;

    const width = 50;
    const height = 8;
    const radius = 0;
    const outlineWidth = 2;

    this.barBackground = new RoundRectangle(scene, {
      color: this.originalBgColor,
      strokeColor: 0x000000,
      strokeWidth: 1,
      radius: radius,
      height: height,
      width: width,
    });

    this.barOutline = new RoundRectangle(scene, {
      x: this.barBackground.getTopLeft().x - outlineWidth / 2,
      y: this.barBackground.getTopLeft().y - outlineWidth / 2,
      color: 0x000000,
      radius: radius,
      height: height + outlineWidth,
      width: width + outlineWidth,
    });

    this.hpBar = new RoundRectangle(scene, {
      x: this.barBackground.getTopLeft().x,
      y: this.barBackground.getTopLeft().y,
      color: color,
      strokeColor: 0x000000,
      strokeWidth: 1,
      radius: radius,
      height: height,
      width: width,
    });

    const trailOptions = {
      x: this.barBackground.getTopLeft().x,
      y: this.barBackground.getTopLeft().y,
      radius: radius,
      height: height,
      width: width,
    };
    this.trailBar = new RoundRectangle(scene, {...trailOptions, color: 0xfff1c9});
    this.previewBar = new RoundRectangle(scene, {...trailOptions, color: 0xffffff});

    this.hpValue = 0;
    this.hpBar.setOrigin(0);
    this.trailBar.setOrigin(0);
    this.previewBar.setOrigin(0).setVisible(false);
    this.barOutline.setOrigin(0);
    this.setHpValue(1);

    this.add(this.barOutline);
    this.add(this.barBackground);
    this.add(this.trailBar);
    this.add(this.hpBar);
    this.add(this.previewBar);
  }

  /**
   * Sets health bar value.
   * @param value A value in range [0, 1]
   * @return An updated instance of the current game object.
   */
  setHpValue(value: number): this {
    if (this.hpValue === value) {
      return this;
    }

    const previous = this.hpValue;
    this.hpValue = Phaser.Math.Clamp(value, 0, 1);
    this.hpBar.scaleX = this.hpValue;
    this.trailTween?.stop();
    if (this.hpValue < previous && this.scene) {
      // The lost chunk stays visible for a moment before draining.
      this.trailBar.scaleX = Math.max(this.trailBar.scaleX, previous);
      this.trailTween = this.scene.tweens.add({
        targets: this.trailBar, scaleX: this.hpValue, delay: 400, duration: 300, ease: 'Cubic.easeIn',
      });
    } else {
      this.trailBar.scaleX = this.hpValue;
    }
    if (this.previewBar.visible || this.skull) this.setPreview(null);
    return this;
  }

  /** Blink the share of the bar a hovered action would remove; null clears it. */
  setPreview(value: number | null) {
    this.previewTween?.stop();
    this.previewTween = null;
    const target = value == null ? this.hpValue : Phaser.Math.Clamp(value, 0, 1);
    const lethal = value != null && target <= 0 && this.hpValue > 0;
    this.showSkull(lethal);
    if (target >= this.hpValue) {
      this.previewBar.setVisible(false);
      return;
    }
    this.previewBar.setPosition(this.hpBar.x + this.hpBar.width * target, this.hpBar.y);
    this.previewBar.scaleX = this.hpValue - target;
    // A lethal blow blinks red rather than white.
    this.previewBar.setFillStyle(lethal ? 0xff3b2f : 0xffffff);
    this.previewBar.setVisible(true).setAlpha(0.9);
    this.previewTween = this.scene.tweens.add({
      targets: this.previewBar, alpha: 0.2, duration: lethal ? 260 : 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private showSkull(visible: boolean) {
    if (!visible) {
      if (this.skull) this.scene?.tweens.killTweensOf(this.skull);
      this.skull?.destroy();
      this.skull = null;
      return;
    }
    if (this.skull) return;
    // A small skull drawn in vector so it stays crisp at any zoom.
    const g = this.scene.add.graphics();
    g.fillStyle(0x1b0f0a, 1).fillCircle(0, -1, 9).fillRoundedRect(-6, 4, 12, 7, 2);
    g.fillStyle(0xfff4e0, 1).fillCircle(0, -1, 7.5).fillRoundedRect(-4.5, 4, 9, 5.5, 1.5);
    g.fillStyle(0x1b0f0a, 1).fillCircle(-3, -1.5, 2.3).fillCircle(3, -1.5, 2.3).fillTriangle(0, 1.5, -1.3, 3.6, 1.3, 3.6);
    g.fillRect(-1.6, 6.5, 0.9, 3).fillRect(0.7, 6.5, 0.9, 3);
    this.skull = this.scene.add.container(0, -16, [g]).setScale(0);
    this.add(this.skull);
    this.scene.tweens.add({targets: this.skull, scale: 1, duration: 220, ease: 'Back.easeOut', onComplete: () => {
      if (this.skull) this.scene.tweens.add({targets: this.skull, scale: 1.15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'});
    }});
  }

  tweenPosition(x?: number, y?: number) {
    this.scene.tweens.add({
      targets: this,
      props: {
        x: x,
        y: y,
      },
      duration: 66,
    });
  }

  darken(): void {
    // Darken the main health bar
    this.hpBar.setFillStyle(this.multiplyColor(this.originalColor, DARKENING_INTENSITY * 2));
    
    // Darken the background
    this.barBackground.setFillStyle(this.multiplyColor(this.originalBgColor, DARKENING_INTENSITY * 2));
  }

  brighten(): void {
    // Restore original colors
    this.hpBar.setFillStyle(this.originalColor);
    this.barBackground.setFillStyle(this.originalBgColor);
  }

  private multiplyColor(color: number, factor: number): number {
    const r = ((color >> 16) & 0xFF) * factor;
    const g = ((color >> 8) & 0xFF) * factor;
    const b = (color & 0xFF) * factor;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }
}
