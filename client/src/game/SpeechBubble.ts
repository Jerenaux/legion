import Phaser from 'phaser';

const ALPHA = 0.7;

export class SpeechBubble extends Phaser.GameObjects.Container {
    private bubble: Phaser.GameObjects.NineSlice;
    private content: Phaser.GameObjects.DOMElement;
    private tail: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
        super(scene, x, y);

        // Create the tail
        this.tail = scene.add.image(0, 0, 'speech_tail');
        this.tail.setOrigin(1, 1).setAlpha(ALPHA).setFlipX(true);
        this.add(this.tail);

        // Create the bubble background
        this.bubble = scene.add.nineslice(0, 0, 'speech_bubble', 0, 200, 100, 5, 5, 5, 5)
            .setOrigin(0.5, 1)
            .setAlpha(ALPHA);
        this.add(this.bubble);

        // Create the DOM element for text
        const style = `
            font-family: Kim;
            font-size: 14px;
            max-width: 130px;
            color: #fff;
            text-align: center;
            height: auto;
            overflow: hidden;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        `;
        this.content = scene.add.dom(0, 0, 'div', style, text);
        this.content.setOrigin(0.5);
        this.add(this.content);

        this.layout();
    }

    private layout(): void {
        requestAnimationFrame(() => {
            const domNode = this.content.node as HTMLElement;
    
            // Get the dimensions
            const textWidth = domNode.offsetWidth + 20;  // Add some padding
            const textHeight = domNode.offsetHeight + 20;
    
            this.bubble.setSize(textWidth, textHeight);
    
            // Position the bubble above the tail
            const tailHeight = this.tail.height;
            this.bubble.setPosition(0, -tailHeight);
    
            // Position the DOM element explicitly
            const contentX = this.bubble.x - textWidth / 2 + 10;  // Centered with padding
            const contentY = this.bubble.y - textHeight + 10;
    
            this.content.setPosition(contentX, contentY);
    
            // Set the container size to match the entire speech bubble (including tail)
            this.setSize(Math.max(this.bubble.width, this.tail.width), this.bubble.height + tailHeight);
        });
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