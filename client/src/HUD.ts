export class HUD extends Phaser.Scene
{
    Arena;
    customCursor;

    constructor() {
        super({ key: 'HUD' });
    }

    preload() {
        this.load.image('cursor',  '/assets/pointers/pointer001.png');
        this.load.image('swords',  '/assets/pointers/swords001.png');
        this.load.image('scroll',  '/assets/pointers/scroll002.png');
    }

    create() {
        this.Arena = this.scene.get('Arena'); 

         // Hide the default cursor
        this.input.setDefaultCursor('none');

        // Add a sprite to use as a cursor
        this.customCursor = this.add.sprite(0, 0, 'cursor').setOrigin(0, 0).setScale(0.5);

        // Make the sprite follow the pointer
        this.input.on('pointermove', function (pointer) {
            this.customCursor.x = pointer.x;
            this.customCursor.y = pointer.y;
        }, this);

        // this.cameras.main.setZoom(1);
    }

    toggleCursor(flag: boolean, cursor?: string, ) {
        if (flag) {
            this.customCursor.setTexture(cursor);
        } else if(!flag && this.customCursor.texture.key == cursor){
            this.customCursor.setTexture('cursor');
        }
    }
}