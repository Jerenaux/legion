import * as Phaser from 'phaser';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';

const desiredAspectRatio = 16 / 9;

const windowAspectRatio = window.innerWidth / window.innerHeight;

let gameWidth;
let gameHeight;

if (windowAspectRatio > desiredAspectRatio) {
    // Window is wider than desired aspect ratio
    gameHeight = window.innerHeight;
    gameWidth = gameHeight * desiredAspectRatio;
} else {
    // Window is narrower than desired aspect ratio
    gameWidth = window.innerWidth;
    gameHeight = gameWidth / desiredAspectRatio;
}

const config = {
    type: Phaser.WEBGL,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight,
    },
    // backgroundColor: '#000',
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


