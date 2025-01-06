import RoundRectangle from 'phaser3-rex-plugins/plugins/roundrectangle.js';
import { DARKENING_INTENSITY } from './Arena';

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly barBackground: RoundRectangle;
  private readonly hpBar: RoundRectangle;
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

    this.hpValue = 0;
    this.hpBar.setOrigin(0);
    this.barOutline.setOrigin(0);
    this.setHpValue(1);

    this.add(this.barOutline);
    this.add(this.barBackground);
    this.add(this.hpBar);
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

    this.hpValue = Phaser.Math.Clamp(value, 0, 1);
    this.hpBar.scaleX = this.hpValue;
    return this;
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
    this.hpBar.setFillStyle(this.multiplyColor(this.originalColor, DARKENING_INTENSITY));
    
    // Darken the background
    this.barBackground.setFillStyle(this.multiplyColor(this.originalBgColor, DARKENING_INTENSITY));
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
