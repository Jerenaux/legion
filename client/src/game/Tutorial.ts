import { Arena } from './Arena';
import { events, GameHUD } from '../components/HUD/GameHUD';
import { AIAttackMode, Class } from '@legion/shared/enums';

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
        this.currentState = 'summonAlly'; //'initial';
        this.flags = {};

        this.initializeStates();
        this.setupEventListeners();
    }

    private initializeStates() {
        this.states = {
            initial: {
                onEnter: () => this.showMessages([
                    "I'm the Taskmaster of the Arena! My job is to make sure you learn the ropes and know how to order your characters around!",
                    "Let's start with a single character. Click on the warrior to select them.",
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
                        this.game.pointToCharacter(true,0);
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
                        this.game.pointToTile(7, 4);
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
                    this.game.hideFloatingHand();
                    this.game.summonEnemy(15, 4);
                },
                transitions: {
                    characterAdded: 'attackInstructions',
                },
            },
            attackInstructions: {
                onEnter: () => {
                    this.game.revealHealthBars();
                    this.game.pointToCharacter(false, 0);
                    this.showMessages([
                        "Here is your first enemy! See the green bars that appeared on your warrior and the enemy? They represent their health (or HP).",
                        "When a character's HP reaches 0, they are KO! Move next to the enemy and click on it to attack it and make it lose HP!",
                    ]);
                },
                transitions: {
                    playerAttacked: 'attackAgain',
                }
            },
            attackAgain: {
                onEnter: () => {
                    this.showMessages([
                        "Great! Keep attacking the enemy until it's KO!",
                    ]);
                },
                transitions: {
                    characterKilled: 'characterKilled',
                },
            },
            characterKilled: {
                onEnter: () => {
                    this.game.hideFloatingHand();
                    this.showMessages([
                        "Great job! Defeating enemies is the way to win! But beware, another one is coming!",
                        ""
                    ]);
                },
                transitions: {
                    nextMessage: 'summonEnemy2',
                },
            },
            summonEnemy2: {
                onEnter: () => {
                    const {x, y} = this.game.getCharacterPosition(true, 0);
                    this.game.summonEnemy(x, y, AIAttackMode.ATTACK_ONCE);
                },
                transitions: {
                    characterKilled: 'characterKilled2',
                    hpChange: 'enemyAttack',
                },
            },
            enemyAttack: {
                onEnter: () => {
                    this.showMessages([
                        "Enemies can also attack! Watch out, you lost some HP! Defeat that other enemy!",
                    ]);
                },
                transitions: {
                    characterKilled: 'characterKilled2',
                },
            },
            characterKilled2: {
                onEnter: () => {
                    this.showMessages([
                        "Well done! Now, looks like someone else is coming...",
                        ""
                    ]);
                },
                transitions: {
                    nextMessage: 'summonAlly',
                },
            },
            summonAlly: {
                onEnter: () => {
                    this.game.summonAlly(4, 4, Class.BLACK_MAGE);
                },
                transitions: {
                    characterAdded: 'mageInstructions',
                },
            },
            mageInstructions: {
                onEnter: () => {
                    this.game.revealMPBars();
                    this.showMessages([
                        "In the arena, you will control multiple characters. You can switch between them by clicking on them.",
                        "This one is a Black Mage! They can cast spells that deal damage and impact the terrain.",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'mageInstructions2',
                },
            },
            mageInstructions2: {
                onEnter: () => {
                    this.game.pointToCharacter(true, 1);
                    this.game.revealMPBars();
                    this.showMessages([
                        "See the blue bar above their head? That's their Magic Points (or MP)!",
                        "Casting spells costs MP; when it's empty, they can't cast spells until they recharge it!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'mageInstructions3',
                },
            },
            mageInstructions3: {
                onEnter: () => {
                    if (this.flags['playerSelected']) {
                        this.transition('selectCharacter_BLACK_MAGE');
                    } else {
                        this.showMessages([
                            "Let's try it out! Click on the Black Mage!",
                        ]);
                    }
                },
                transitions: {
                    selectCharacter_BLACK_MAGE: 'mageInstructions4',
                },
            },
            mageInstructions4: {
                onEnter: () => {
                    this.revealTopMenu();
                    this.game.hideFloatingHand();
                    this.showMessages([
                        "This menu appears when you select a character. You can see better their HP (red bar) and MP (blue bar), and in the case of mages, their spells!",
                        "Click on the Fireball icon to select that spell!",
                    ]);
                },
                transitions: {
                    selectedSpell_FIREBALL: 'mageInstructions5',
                },
            },
            mageInstructions5: {
                onEnter: () => {
                    if (this.flags['playerCastSpell_FIREBALL']) {
                        this.transition('playerCastSpell_FIREBALL');
                    } else {
                        this.game.summonEnemy(10, 4);
                        this.showMessages([
                            "Great! Now, click on the enemy to cast the spell on it!",
                        ]);
                    }
                },
                transitions: {
                    playerCastSpell_FIREBALL: 'introToCooldown',
                }
            },
            introToCooldown: {
                onEnter: () => {
                    console.log(`[Tutorial:introToCooldown] onEnter`);
                    this.game.hideFloatingHand();
                    this.gameHUD.revealCooldown();
                    if (!this.game.isCharacterSelected(1)) { 
                        console.log(`[Tutorial:introToCooldown] Transitioning to ensureSelectedMageForCooldown`);
                        this.transition('ensureSelectedMageForCooldown');
                    } else {
                        console.log(`[Tutorial:introToCooldown] Showing messages`);
                        this.showMessages([
                            "You see that loading yellow bar in the menu at the top? That's the cooldown bar of your character.",
                            "Whenever a character performs an action, any action, they enter a cooldown state for a few seconds and cannot perform any other actions.",
                            "The cooldown bar slowly fills up as time passes, and once it's full, the character can perform the action again.",
                            "While one character is on cooldown, you can switch to another character and perform actions with them!",
                            "",
                        ]);
                    }
                },
                transitions: {
                    lastMessage: 'introToFlames',
                }
            },
            introToFlames: {
                onEnter: () => {
                    this.showMessages([
                        "Notice the flame that appeared? Elemental spells can affect the terrain of the arena!",
                        "Make sure not to step through flames or keep a character in a flame after being targeted by a fire spell, or they will lose HP repeatedly over time!",
                        "",
                    ]);
                },
                transitions: {
                    enemyAdded: 'ensureSelectedMageForItems',
                }
            },
            ensureSelectedMageForCooldown: {
                onEnter: () => {
                    console.log(`[Tutorial:ensureSelectedMageForCooldown] onEnter`);
                    this.game.pointToCharacter(true, 1);
                    this.showMessages([
                        "Now, select the Black Mage again!",
                    ]);
                },
                transitions: {
                    selectCharacter_BLACK_MAGE: 'introToCooldown',
                }
            },
            ensureSelectedMageForItems: {
                onEnter: () => {
                    this.game.pointToCharacter(true, 1);
                    this.showMessages([
                        "Now, select the Black Mage again!",
                    ]);
                },
                transitions: {
                    selectCharacter_BLACK_MAGE: 'introToItems',
                }
            },
            introToItems: {
                onEnter: () => {
                    this.game.hideFloatingHand();
                    this.gameHUD.revealItems();
                    this.showMessages([
                        "Now you can see your items! Each character can carry some items to use in battle.",
                        "You can use an item by clicking on it. The blue potion is an Ether, it will restore some MP to the character. Go ahead and use it!",
                    ]);
                },
                transitions: {
                    playerUseItem_1: 'introToOverview',
                }
            },
            introToOverview: {
                onEnter: () => {
                    this.gameHUD.revealOverview();
                    this.showMessages([
                        "Now you can see the entire interface. This last part, on the sides, is the overview of each team.",
                        "There you can see in a glance what are the HP, MP and cooldown of each character!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'introToHealing',
                }
            },
            introToHealing: {
                onEnter: () => {
                    this.game.summonAlly(16, 4, Class.WHITE_MAGE);
                    this.showMessages([
                        "Now your initial team is complete! Here is your White Mage. White mages can cast healing spells and learn more tactical spells as well.",
                        "",
                    ]);
                },
                transitions: {
                    enemyAdded: 'introToOverview2',
                }
            },
        };
    }

    private setupEventListeners() {
        events.on('nextTutorialMessage', () => this.transition('nextMessage'));
        events.on('selectPlayer', () => this.setFlag('playerSelected', true));
        events.on('playerMoved', () => this.setFlag('playerMoved', true));
        events.on('characterAdded', () => this.transition('characterAdded'));
        events.on('playerAttacked', () => this.transition('playerAttacked'));
        events.on('characterKilled', () => this.transition('characterKilled'));
        events.on('hpChange', () => this.transition('hpChange'));
        events.on('lastTutorialMessage', () => this.transition('lastMessage'));
        events.on('selectCharacter_2', () => this.setFlag('selectCharacter_BLACK_MAGE', true));
        events.on('selectedSpell_0', () => this.transition('selectedSpell_FIREBALL'));
        events.on('playerCastSpell_0', () => this.setFlag('playerCastSpell_FIREBALL', true));
        events.on('playerUseItem_1', () => this.transition('playerUseItem_ETHER'));
    }

    private setFlag(flag: string, value: boolean) {
        console.log(`[Tutorial:setFlag] Setting flag ${flag} to ${value}`);
        this.flags[flag] = value;
        this.checkFlagTransitions();
    }

    private checkFlagTransitions() {
        const currentState = this.states[this.currentState];
        console.log(`[Tutorial:checkFlagTransitions] Checking transitions for ${this.currentState}`);
        for (const [action, nextState] of Object.entries(currentState.transitions)) {
            console.log(`[Tutorial:checkFlagTransitions] Checking action ${action}`);
            if (this.flags[action]) {
                console.log(`[Tutorial:checkFlagTransitions] Transitioning to ${nextState}`);
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

    private revealTopMenu() {
        events.emit('revealTopMenu');
    }

    start() {
        const initialState = this.states[this.currentState];
        if (initialState.onEnter) initialState.onEnter();
    }
}
