import Phaser from 'phaser';

const ALPHA = 0.9;

export class SpeechBubble extends Phaser.GameObjects.Container {
    private bubble: Phaser.GameObjects.NineSlice;
    private content: Phaser.GameObjects.Text;
    private tail: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
        super(scene, x, y);

        // Create the tail
        this.tail = scene.add.image(0, 0, 'speech_tail');
        this.tail.setOrigin(1, 1).setAlpha(ALPHA).setFlipX(true); // Set origin to bottom right
        this.add(this.tail);

        // Create the bubble background
        this.bubble = scene.add.nineslice(0, 0, 'speech_bubble', 0, 200, 100, 5, 5, 5, 5)
            .setOrigin(0.5, 1)
            .setAlpha(ALPHA);
        this.add(this.bubble);

        // Create the text
        this.content = scene.add.text(0, 0, text, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#fff',
            align: 'center',
            wordWrap: { width: 180 } 
        });
        this.content.setOrigin(0.5);
        this.add(this.content);

        this.layout();
    }

    private layout(): void {
        // Resize the bubble based on the text size
        const textWidth = this.content.width + 20;  // Add some padding
        const textHeight = this.content.height + 20;

        this.bubble.setSize(textWidth, textHeight);

        // Position the bubble above the tail
        const tailHeight = this.tail.height;
        this.bubble.setPosition(0, -tailHeight);

        // Center the text in the bubble
        this.content.setPosition(this.bubble.x, this.bubble.y - this.bubble.height / 2);

        // Set the container size to match the entire speech bubble (including tail)
        this.setSize(Math.max(this.bubble.width, this.tail.width), this.bubble.height + tailHeight);
    }

    public setText(text: string): void {
        this.content.setText(text);
        this.layout();
    }

    public setVisible(visible: boolean): this {
        super.setVisible(visible);
        return this;
    }
}