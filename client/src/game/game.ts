import * as Phaser from 'phaser';
import { Arena } from './Arena';
import RoundRectanglePlugin from 'phaser3-rex-plugins/plugins/roundrectangle-plugin.js';
import {captureCombatFrame} from '../telemetry';
import {addBreadcrumb, setTag} from '@sentry/react';

const gameWidth = 1920;
const gameHeight = 1080;

const config = {
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
    // Reuse the probed context: drivers may advertise WebGL but refuse to create it.
    const canvas = document.createElement('canvas');
    let context: WebGLRenderingContext | null = null;
    try {
        context = canvas.getContext('webgl', {alpha: true, stencil: true, antialias: true,
            depth: false, premultipliedAlpha: true, preserveDrawingBuffer: false});
    } catch { /* Phaser's Canvas renderer remains available on unsupported GPUs. */ }
    if (!context && !canvas.getContext('2d')) throw new Error('No supported combat renderer');
    const game = new Phaser.Game({...config, canvas,
        type: context ? Phaser.WEBGL : Phaser.CANVAS,
        loader: {maxParallelDownloads: 4},
    });
    setTag('combat.renderer', context ? 'webgl' : 'canvas');
    addBreadcrumb({category: 'combat', message: 'Engine created'});
    game.events.on(Phaser.Core.Events.POST_RENDER, () => captureCombatFrame(game.canvas));
    game.events.once(Phaser.Core.Events.DESTROY, () => {
        addBreadcrumb({category: 'combat', message: 'Engine destroyed'});
        // Phaser deletes textures synchronously; release the driver's context afterwards.
        queueMicrotask(() => context?.getExtension('WEBGL_lose_context')?.loseContext());
    });
    return game;
}

export function stopGame(game: Phaser.Game) {
    let destroyed = false;
    game.events.once(Phaser.Core.Events.DESTROY, () => { destroyed = true; });
    game.destroy(true);
    // Finish after the current call stack, even if a hidden window stops animation frames.
    // With pendingDestroy set, Phaser's own step only destroys; it cannot update/render.
    const finish = () => queueMicrotask(() => { if (!destroyed) game.step(0, 0); });
    if (game.isRunning) finish();
    else game.events.once(Phaser.Core.Events.READY, finish);
}
