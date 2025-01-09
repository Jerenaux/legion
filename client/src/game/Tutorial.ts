import { Arena } from './Arena';
import { events, GameHUD } from '../components/HUD/GameHUD';
import { AIAttackMode, Class, GEN } from '@legion/shared/enums';
import { apiFetch } from '../services/apiService';

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
                onEnter: () => {
                    this.game.summonEnemy(15, 4);
                },
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
                    if (this.game.isCharacterSelected(2)) {
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
                    this.game.slowDownCooldowns();
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
                    this.game.hideFloatingHand();
                    this.revealCooldown();
                    if (!this.game.isCharacterSelected(2)) { 
                        this.transition('ensureSelectedMageForCooldown');
                    } else {
                        this.showMessages([
                            "Great job! You see that loading yellow bar in the menu at the top? That's the cooldown bar of your character.",
                            "When a character acts, they enter a cooldown state and cannot act again for a few seconds.",
                            "The cooldown bar slowly fills up as time passes, and once it's full, the character can perform actions again.",
                            "While one character is on cooldown, you can switch to another character and perform actions with them!",
                            "",
                        ]);
                    }
                },
                transitions: {
                    lastMessage: 'introToFlames',
                    ensureSelectedMageForCooldown: 'ensureSelectedMageForCooldown',
                }
            },
            introToFlames: {
                onEnter: () => {
                    this.showMessages([
                        "Notice the flame that appeared? Elemental spells can affect the terrain of the arena!",
                        "Make sure not to step through flames or keep a character in one, or they will lose HP repeatedly over time!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'ensureSelectedMageForItems',
                }
            },
            ensureSelectedMageForCooldown: {
                onEnter: () => {
                    if (this.game.isCharacterSelected(2)) {
                        this.transition('selectCharacter_BLACK_MAGE');
                    } else {
                        this.game.pointToCharacter(true, 1);
                        this.showMessages([
                            "Now, select the Black Mage again!",
                        ]);
                    }
                },
                transitions: {
                    selectCharacter_BLACK_MAGE: 'introToCooldown',
                }
            },
            ensureSelectedMageForItems: {
                onEnter: () => {
                    if (this.game.isCharacterSelected(2)) {
                        this.transition('selectCharacter_BLACK_MAGE');
                    } else {
                        this.game.pointToCharacter(true, 1);
                        this.showMessages([
                            "Now, select the Black Mage again!",
                        ]);
                    }
                },
                transitions: {
                    selectCharacter_BLACK_MAGE: 'introToItems',
                }
            },
            introToItems: {
                onEnter: () => {
                    this.game.hideFloatingHand();
                    this.revealItems();
                    this.showMessages([
                        "Now you can see your items in the top menu! Each character can carry some items to use in battle.",
                        "You can use an item by clicking on it. The blue potion is an Ether, it will restore MP to the character.",
                        ""
                    ]);
                },
                transitions: {
                    lastMessage: 'waitForCooldown',
                    playerUseItem_ETHER: 'introToOverview',
                }
            },
            waitForCooldown: {
                onEnter: () => {
                    if (true) {
                    // if (this.game.isCharacterReady(1)) {
                        this.transition('cooldownEnded_BLACK_MAGE');
                    } else {
                        this.showMessages([
                            "Wait for the cooldown to finish before you can use the item!",
                        ]);
                    }
                },
                transitions: {
                    cooldownEnded_BLACK_MAGE: 'useItem',
                }
            },
            useItem: {
                onEnter: () => {
                    this.showMessages([
                        "Now, use the Ether by clicking on it!",
                    ]);
                },
                transitions: {
                    playerUseItem_ETHER: 'congratsItem',
                }
            },
            congratsItem: {
                onEnter: () => {
                    this.showMessages([
                        "Well done, your Black Mage restored some MP!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'introToOverview',
                }
            },
            introToOverview: {
                onEnter: () => {
                    this.revealOverview();
                    this.showMessages([
                        "Now you can see the entire interface!", 
                        "On the sides are the overviews of each team. Your team is on the left, and the enemy team is on the right.",
                        "There you can see at a glance what are the HP, MP and cooldown of your characters!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'whiteMageEntrance',
                }
            },
            whiteMageEntrance: {
                onEnter: () => {
                    this.game.summonAlly(4, 5, Class.WHITE_MAGE);
                },
                transitions: {
                    characterAdded: 'fullTeam',
                }
            },
            fullTeam: {
                onEnter: () => {
                    this.showMessages([
                        "Now your initial team is complete! Here is your White Mage.", 
                        "White mages can cast healing spells and learn more tactical spells as well.",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'pvpIntro',
                }
            },
            pvpIntro: {
                onEnter: () => {
                    this.showMessages([
                        "Now it's time for a real battle! Use what you learned to control your 3 characters and defeat the enemy team!",
                        "Once you finish this battle, these 3 characters will be yours to keep! The beginning of your team!",
                        "After that you'll be able to use them in any game mode, including against other human players!",
                        "Good luck!",
                        "",
                    ]);
                },
                transitions: {
                    lastMessage: 'coda',
                }
            },
            coda: {
                onEnter: () => {
                    this.game.displayGEN(GEN.COMBAT_BEGINS);
                    this.game.putInFormation();
                    this.game.endTutorial();
                },
                transitions: {}
            }
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
        events.on('cooldownEnded_1', () => this.transition('cooldownEnded_BLACK_MAGE'));
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

    private async transition(action: string) {
        const currentState = this.states[this.currentState];
        const nextStateName = currentState.transitions[action];

        if (nextStateName) {
            if (currentState.onExit) currentState.onExit();
            
            this.currentState = nextStateName;
            const nextState = this.states[nextStateName];
            
            if (nextState.onEnter) {
                this.recordTutorialStep(nextStateName);
                nextState.onEnter();
            };
        }
    }

    private showMessages(messages: string[]) {
        events.emit('showTutorialMessage', messages);
    }

    private revealTopMenu() {
        events.emit('revealTopMenu');
    }

    private revealOverview() {
        events.emit('revealOverview');
    }

    private revealCooldown() {
        events.emit('revealCooldown');
    }

    private revealItems() {
        events.emit('revealItems');
    }

    start() {
        const initialState = this.states[this.currentState];
        if (initialState.onEnter) {
            this.recordTutorialStep('initial');
            initialState.onEnter();
        };
    }

    recordTutorialStep(step: string) {
        apiFetch('recordPlayerAction', {
            method: 'POST',
            body: {
                actionType: 'tutorial',
                details: step,
            },
        });
    }
}
