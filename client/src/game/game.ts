import * as Phaser from 'phaser';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';

const config = {
    type: Phaser.WEBGL,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // audio: {
    //     disableWebAudio: false // Ensure Web Audio is enabled
    // },
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
    scene: [Arena],
};

export function startGame() {
    new Phaser.Game(config);
}


