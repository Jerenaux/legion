import { t } from '../i18n/core';
import type { EventEmitter } from 'eventemitter3';
import type { EngagementStats } from '@legion/shared/interfaces';

export interface TutorialContext {
    turn: number;
    name: string;
    ownTurn: boolean;
    selectedIsTurnee: boolean;
    canAct: boolean;
    hasEnemy: boolean;
    spells: { name: string; cost: number; healing?: boolean }[];
    hasWoundedAlly?: boolean;
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
        playerMoved: () => this.acceptAction('everMoved', 'Movement used your action. The portraits show who acts next.'),
        playerAttacked: () => this.acceptAction('everAttacked', 'Attack complete. The portraits show who acts next.'),
        playerCastSpell: () => this.acceptAction('everUsedSpell', 'Spell cast. The portraits show who acts next.'),
        playerUseItem: () => this.acceptAction('everUsedItem', 'Item used. The portraits show who acts next.'),
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

        if (!c.ownTurn) {
            this.events.emit('hideTutorialMessage');
            return;
        }
        const healingOnly = c.spells.length > 0 && c.spells.every(spell => spell.healing);
        if (this.actionTurn === c.turn) {
            show(t('Action used'), t(this.lastAction), 'timeline');
        } else if (!c.selectedIsTurnee) {
            show(t('{{name}} acts now', {name: c.name}), t('Only the active character can act. Select them to choose your action.'), 'timeline');
        } else if (c.pendingSpell) {
            show(t('Aim {{spell}}', {spell: t(c.pendingSpell.name)}), c.pendingSpell.area
                ? t('Choose a highlighted target. Costs {{cost}} MP. The area can also hit allies. Select the spell again to cancel.', {cost: c.pendingSpell.cost})
                : t('Choose a highlighted target. Costs {{cost}} MP. Select the spell again to cancel.', {cost: c.pendingSpell.cost}));
        } else if (c.pendingItem) {
            show(t('Use {{item}}', {item: t(c.pendingItem)}), t('Choose a highlighted target. Select the item again to cancel.'));
        } else if (c.ice) {
            show(t('Frozen in ice'), t('Another character can attack the ice to break it.'));
        } else if (c.paralyzed || !c.canAct) {
            show(t('Unable to act'), t('This character cannot act right now. Watch the turn order for your next character.'), 'timeline');
        } else if (c.fire) {
            show(t('Move out of the flames'), t('Choose a blue tile away from the fire to avoid repeated damage. Moving uses your action.'));
        } else if (c.muted) {
            show(t('Silenced'), t('Spells are unavailable. You can still move, attack, use an item, or pass.'));
        } else if (c.spells.length && c.spells.every(spell => spell.cost > c.mp)) {
            show(t('Low mana'), t('You need more MP to cast these spells. Choose another action, or use an Ether if you have one.'), c.hasItem ? 'items' : undefined);
        } else if (healingOnly) {
            if (c.hasWoundedAlly) {
                show(t('Help an injured ally'), t('Choose a healing spell below, then a wounded ally in range.'), 'spells');
            } else {
                show(t('Keep your healer safe'), t('Move closer to your team, or pass. Heal when an injured ally is in range.'));
            }
        } else if (c.hasEnemy && !this.stats.everAttacked) {
            show(t('Attack an adjacent enemy'), t('Select the enemy beside you to attack. Attacking uses your action.'));
        } else if (c.spells.length && !this.stats.everUsedSpell) {
            show(t('Try your magic'), t('Choose a spell below, then a highlighted target. Casting uses your action.'), 'spells');
        } else if (!this.stats.everMoved) {
            show(t('Move into position'), t('Choose a blue tile. Moving uses your one action for this turn.'));
        } else if (c.hasItem && !this.stats.everUsedItem) {
            show(t('Use an item'), t('Select an item below when you need it. Using it takes your action.'), 'items');
        } else if (c.poison) {
            show(t('Poisoned'), t('Poison damages this character each turn. An Antidote removes it.'));
        } else {
            show(t('Choose your next move'), learned === 3
                ? t('Basics learned. Move, attack, cast, or use an item. Pass if you prefer to wait.')
                : t('Move toward the enemy, attack an adjacent enemy, or cast a spell. Each uses your action.'));
        }
    }

    destroy() {
        this.ended = true;
        for (const [event, handler] of Object.entries(this.handlers)) this.events.off(event, handler);
    }
}
