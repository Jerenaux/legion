import RoundRectangle from 'phaser3-rex-plugins/plugins/roundrectangle.js';

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly barBackground: RoundRectangle;
  private readonly hpBar: RoundRectangle;
  private readonly barOutline: RoundRectangle;
  private hpValue: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    super(scene, x, y);

    const width = 50;
    const height = 8;
    const radius = 0;
    const outlineWidth = 2;

    this.barBackground = new RoundRectangle(scene, {
      color: 0xa31720,
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
}
