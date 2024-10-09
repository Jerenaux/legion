import * as Phaser from 'phaser';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';

let gameWidth;
let gameHeight;

gameWidth = 1800;
gameHeight = 900;

const config = {
    type: Phaser.WEBGL,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: Math.ceil(gameWidth),
        height: Math.ceil(gameHeight),
    },
    transparent: true,
    parent: 'scene',
    dom: {
        createContainer: true
    },
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


