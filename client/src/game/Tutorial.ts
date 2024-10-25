import { Arena } from './Arena';
import { events, GameHUD } from '../components/HUD/GameHUD';

export class Tutorial {
    private game: Arena;
    private gameHUD: GameHUD;   

    constructor(game: Arena, gameHUD: GameHUD) {
        this.game = game;
        this.gameHUD = gameHUD;
    }

    start() {
        const messages = [
            "I'm the Taskmaster of the Arena! My job is to make sure you learn the ropes and know how to order your warriors around!",
            "Second message",
        ];
        console.log(`Emitting tutorial messages: ${messages}`);
        events.emit('showTutorialMessage', messages);
    }
}
