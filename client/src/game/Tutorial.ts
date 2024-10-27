import { Arena } from './Arena';
import { events, GameHUD } from '../components/HUD/GameHUD';

type TutorialState = {
  onEnter?: () => void;
  onExit?: () => void;
  transitions: { [key: string]: string };
};

type FlagCondition = {
  flag: string;
  value: boolean;
};

/**
 * To add a state:
 * - Add a new state to the states object
 * - Add the listener in setupEventListeners
 * - in onEnter, check if the flag is set
 * - if it is, transition to the next state
 * - otherwise, do the action
 */

export class Tutorial {
    private game: Arena;
    private gameHUD: GameHUD;
    private currentState: string;
    private states: { [key: string]: TutorialState };
    private flags: { [key: string]: boolean };

    constructor(game: Arena, gameHUD: GameHUD) {
        this.game = game;
        this.gameHUD = gameHUD;
        this.currentState = 'initial';
        this.flags = {};

        this.initializeStates();
        this.setupEventListeners();
    }

    private initializeStates() {
        this.states = {
            initial: {
                onEnter: () => this.showMessages([
                    "I'm the Taskmaster of the Arena! My job is to make sure you learn the ropes and know how to order your warriors around!",
                    "Let's start with a single warrior. Click on the warrior to select them.",
                ]),
                transitions: {
                    nextMessage: 'pointToCharacter',
                },
            },
            pointToCharacter: {
                onEnter: () => {
                    if (this.flags['playerSelected']) {
                        this.transition('playerSelected');
                    } else {
                        this.game.pointToCharacter(0);
                    }
                },
                transitions: {
                    playerSelected: 'pointToTile',
                },
            },
            pointToTile: {
                onEnter: () => {
                    if (this.flags['playerMoved']) {
                        this.transition('playerMoved');
                    } else {
                        this.game.pointToTile(6, 4);
                        this.showMessages([
                        "Now, click on the tile you want to move your warrior to. You can move to any tile highlighted in yellow.",
                        ]);
                    }
                },
                transitions: {
                    playerMoved: 'summonEnemy',
                },
            },
            summonEnemy: {
                onEnter: () => {
                    this.game.summonEnemy();
                },
                transitions: {},
            },
        };
    }

    private setupEventListeners() {
        events.on('nextTutorialMessage', () => this.transition('nextMessage'));
        events.on('selectPlayer', () => this.setFlag('playerSelected', true));
        events.on('playerMoved', () => this.setFlag('playerMoved', true));
    }

    private setFlag(flag: string, value: boolean) {
        this.flags[flag] = value;
        this.checkFlagTransitions();
    }

    private checkFlagTransitions() {
        const currentState = this.states[this.currentState];
        for (const [action, nextState] of Object.entries(currentState.transitions)) {
            if (this.flags[action]) {
                this.transition(action);
                break;
            }
        }
    }

    private transition(action: string) {
        const currentState = this.states[this.currentState];
        const nextStateName = currentState.transitions[action];

        if (nextStateName) {
            if (currentState.onExit) currentState.onExit();
            
            this.currentState = nextStateName;
            const nextState = this.states[nextStateName];
            
            if (nextState.onEnter) nextState.onEnter();
        }
    }

    private showMessages(messages: string[]) {
        events.emit('showTutorialMessage', messages);
    }

    start() {
        const initialState = this.states[this.currentState];
        if (initialState.onEnter) initialState.onEnter();
    }
}
