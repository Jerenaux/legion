import * as Phaser from 'phaser';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';
import {captureCombatFrame} from '../telemetry';

const gameWidth = 1920;
const gameHeight = 1080;

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
    pixelArt: false,
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
    const game = new Phaser.Game(config);
    game.events.on(Phaser.Core.Events.POST_RENDER, () => captureCombatFrame(game.canvas));
}
