import type { EventEmitter } from 'eventemitter3';
import type { EngagementStats } from '@legion/shared/interfaces';

export interface TutorialContext {
    turn: number;
    name: string;
    ownTurn: boolean;
    selectedIsTurnee: boolean;
    canAct: boolean;
    hasEnemy: boolean;
    spells: { name: string; cost: number }[];
    hasItem: boolean;
    mp: number;
    pendingSpell?: { name: string; cost: number; area: boolean };
    pendingItem?: string;
    fire: boolean;
    ice: boolean;
    poison: boolean;
    muted: boolean;
    paralyzed: boolean;
}

export interface TutorialMessage {
    title: string;
    content: string;
    focus?: 'spells' | 'items' | 'timeline';
    learned: number;
}

// Store the player's choice, not progress. Learned actions come from the match/account.
export function combatTipsVisible(defaultVisible: boolean): boolean {
    try {
        const preference = localStorage.getItem('legion-combat-tips');
        return preference === null ? defaultVisible : preference === 'shown';
    } catch { return defaultVisible; }
}

export function saveCombatTips(visible: boolean) {
    try { localStorage.setItem('legion-combat-tips', visible ? 'shown' : 'hidden'); } catch { /* Storage can be unavailable. */ }
}

export class TutorialManager {
    private context?: TutorialContext;
    private actionTurn = -1;
    private lastAction = '';
    private ended = false;
    private stats: Partial<EngagementStats>;
    private handlers = {
        tutorialContext: (context: TutorialContext) => { this.context = context; this.refresh(); },
        playerMoved: () => this.acceptAction('everMoved', 'Movement used your action.'),
        playerAttacked: () => this.acceptAction('everAttacked', 'Attack complete.'),
        playerCastSpell: () => this.acceptAction('everUsedSpell', 'Spell cast.'),
        playerUseItem: () => this.acceptAction('everUsedItem', 'Item used.'),
        gameEnd: () => { this.ended = true; this.events.emit('hideTutorialMessage'); },
    };

    constructor(private events: EventEmitter, stats: Partial<EngagementStats>) {
        this.stats = { ...stats };
        for (const [event, handler] of Object.entries(this.handlers)) events.on(event, handler);
    }

    private acceptAction(flag: keyof EngagementStats, explanation: string) {
        if (this.ended) return;
        this.stats = { ...this.stats, [flag]: true };
        this.actionTurn = this.context?.turn ?? -1;
        this.lastAction = explanation;
        this.refresh();
    }

    private refresh() {
        const c = this.context;
        if (!c || this.ended) return;
        const learned = [this.stats.everMoved, this.stats.everAttacked, this.stats.everUsedSpell].filter(Boolean).length;
        const show = (title: string, content: string, focus?: TutorialMessage['focus']) =>
            this.events.emit('showTutorialMessage', { title, content, focus, learned });

        if (this.actionTurn === c.turn) {
            show('Action used', `${this.lastAction} The portraits show who acts next.`, 'timeline');
        } else if (!c.ownTurn) {
            show("Opponent’s turn", `${this.lastAction ? `${this.lastAction} ` : ''}Watch the turn order. Your next character is selected automatically.`, 'timeline');
        } else if (!c.selectedIsTurnee) {
            show(`${c.name} acts now`, 'Only the active character can act. Select them to choose your action.', 'timeline');
        } else if (c.pendingSpell) {
            show(`Aim ${c.pendingSpell.name}`, `Choose a highlighted target. Costs ${c.pendingSpell.cost} MP.${c.pendingSpell.area ? ' The area can also hit allies.' : ''} Select the spell again to cancel.`);
        } else if (c.pendingItem) {
            show(`Use ${c.pendingItem}`, 'Choose a highlighted target. Select the item again to cancel.');
        } else if (c.ice) {
            show('Frozen in ice', 'Another character can attack the ice to break it.');
        } else if (c.paralyzed || !c.canAct) {
            show('Unable to act', 'This character cannot act right now. Watch the turn order for your next character.', 'timeline');
        } else if (c.fire) {
            show('Move out of the flames', 'Choose a blue tile away from the fire to avoid repeated damage. Moving uses your action.');
        } else if (c.muted) {
            show('Silenced', 'Spells are unavailable. You can still move, attack, use an item, or pass.');
        } else if (c.spells.length && c.spells.every(spell => spell.cost > c.mp)) {
            show('Low mana', 'You need more MP to cast these spells. Choose another action, or use an Ether if you have one.', c.hasItem ? 'items' : undefined);
        } else if (c.hasEnemy && !this.stats.everAttacked) {
            show('Attack an adjacent enemy', 'Select the enemy beside you to attack. Attacking uses your action.');
        } else if (c.spells.length && !this.stats.everUsedSpell) {
            show(`${c.name}: choose a spell`, 'Select a spell below, then aim it. Casting uses your action, so you cannot also move.', 'spells');
        } else if (!this.stats.everMoved) {
            show(`${c.name}: move into position`, 'Choose a blue tile. Moving uses your action, so you cannot also attack this turn.');
        } else if (c.hasItem && !this.stats.everUsedItem) {
            show('Use an item', 'Select an item below when you need it. Using it takes your action.', 'items');
        } else if (c.poison) {
            show('Poisoned', 'Poison damages this character each turn. An Antidote removes it.');
        } else {
            show(`${c.name}: choose one action`, learned === 3
                ? 'Basics learned. Move, attack, cast, or use an item. Pass if you prefer to wait.'
                : 'Move toward the enemy, attack an adjacent enemy, or cast a spell. Each uses your action.');
        }
    }

    destroy() {
        this.ended = true;
        for (const [event, handler] of Object.entries(this.handlers)) this.events.off(event, handler);
    }
}
