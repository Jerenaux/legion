import { Arena } from './Arena';
import { GameHUD } from '../components/HUD/GameHUD';

export class Tutorial {
    private game: Arena;
    private gameHUD: GameHUD;   

    constructor(game: Arena, gameHUD: GameHUD) {
        this.game = game;
        this.gameHUD = gameHUD;
    }

    start() {
        this.gameHUD.showTutorialMessage("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.");
    }
}
