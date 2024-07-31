export class CircularProgress extends Phaser.GameObjects.Graphics {
    radius;
    progress;
    color;

    constructor(scene, x, y, radius, color) {
      super(scene);
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.progress = 0; // start at 0 progress
      this.color = color;
      this.scene.add.existing(this);
      this.draw(); // draw once at the start
    }
  
    setProgress(value) {
      this.progress = Phaser.Math.Clamp(value, 0, 1);
      this.draw();
    }
  
    draw() {
        this.clear();

        // Draw the background circle
        this.fillStyle(0xffffff, 1); // Set fill style: (color, alpha)
        this.beginPath();
        this.arc(this.x, this.y, this.radius, 0, Phaser.Math.PI2, false);
        this.fillPath();

        // Draw the progress arc
        this.fillStyle(this.color, 1); // (color, alpha)
        this.beginPath();
        this.moveTo(this.x, this.y); // Start from the center
        this.arc(this.x, this.y, this.radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90) + Phaser.Math.PI2 * this.progress, false);
        this.lineTo(this.x, this.y); // Draw a line back to the center
        this.fillPath();

        // Draw the stroke
        this.lineStyle(2, 0x000000, 1); // Set line style: (width, color, alpha)
        this.beginPath();
        this.arc(this.x, this.y, this.radius, 0, Phaser.Math.PI2, false);
        this.closePath();
        this.strokePath();
    }
  }
  