import * as Phaser from 'phaser';
import { HUD } from './HUD';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';

const config = {
    type: Phaser.WEBGL,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: '#000',
    parent: 'scene',
    pixelArt: true,
    plugins: {
        global:[
            {
                key: 'rexRoundRectanglePlugin',
                plugin: RoundRectanglePlugin,
                start: true
            }
        ]
    },
    scene: [Arena, HUD],
};

export function startGame() {
    new Phaser.Game(config);
}


