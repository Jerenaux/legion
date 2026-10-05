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
    icon?: 'move' | 'attack' | 'spell' | 'item' | 'turn';
    cost?: number;
    warning?: string;
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
    private ended = false;
    private stats: Partial<EngagementStats>;
    private handlers = {
        tutorialContext: (context: TutorialContext) => { this.context = context; this.refresh(); },
        playerMoved: () => this.acceptAction('everMoved'),
        playerAttacked: () => this.acceptAction('everAttacked'),
        playerCastSpell: () => this.acceptAction('everUsedSpell'),
        playerUseItem: () => this.acceptAction('everUsedItem'),
        gameEnd: () => { this.ended = true; this.events.emit('hideTutorialMessage'); },
    };

    constructor(private events: EventEmitter, stats: Partial<EngagementStats>) {
        this.stats = { ...stats };
        for (const [event, handler] of Object.entries(this.handlers)) events.on(event, handler);
    }

    private acceptAction(flag: keyof EngagementStats) {
        if (this.ended) return;
        this.stats = { ...this.stats, [flag]: true };
        this.actionTurn = this.context?.turn ?? -1;
        this.refresh();
    }

    private refresh() {
        const c = this.context;
        if (!c || this.ended) return;
        const learned = [this.stats.everMoved, this.stats.everAttacked, this.stats.everUsedSpell].filter(Boolean).length;
        const show = (title: string, content: string, detail: Partial<TutorialMessage> = {}) =>
            this.events.emit('showTutorialMessage', {title, content, learned, ...detail});

        if (!c.ownTurn) {
            this.events.emit('hideTutorialMessage');
            return;
        }
        const healingOnly = c.spells.length > 0 && c.spells.every(spell => spell.healing);
        if (this.actionTurn === c.turn) {
            show(t('Turn over'), t('The portraits show who acts next.'), {focus: 'timeline', icon: 'turn'});
        } else if (!c.selectedIsTurnee) {
            show(t('{{name}} acts now', {name: c.name}), t('Select the active character.'), {focus: 'timeline', icon: 'turn'});
        } else if (c.pendingSpell) {
            show(t('Aim {{spell}}', {spell: t(c.pendingSpell.name)}),
                t('Select a highlighted target. Select the spell again to cancel.'),
                {icon: 'spell', cost: c.pendingSpell.cost, warning: c.pendingSpell.area ? t('Can hit allies') : undefined});
        } else if (c.pendingItem) {
            show(t('Use {{item}}', {item: t(c.pendingItem)}), t('Choose a highlighted target. Select the item again to cancel.'), {icon: 'item'});
        } else if (c.ice) {
            show(t('Frozen in ice'), t('Another character can attack the ice to break it.'));
        } else if (c.paralyzed || !c.canAct) {
            show(t('Unable to act'), t('The portraits show who acts next.'), {focus: 'timeline', icon: 'turn'});
        } else if (c.fire) {
            show(t('Move out of the flames'), t('Select a blue tile outside the fire.'), {icon: 'move'});
        } else if (c.muted) {
            show(t('Silenced'), t('Spells are unavailable. Move, attack, or use an item.'));
        } else if (c.spells.length && c.spells.every(spell => spell.cost > c.mp)) {
            show(t('Low mana'), t('Use an Ether to restore MP, or choose another action.'), {focus: c.hasItem ? 'items' : undefined, icon: 'item'});
        } else if (healingOnly) {
            if (c.hasWoundedAlly) {
                show(t('Help an injured ally'), t('Select a healing spell, then an injured ally.'), {focus: 'spells', icon: 'spell'});
            } else {
                show(t('Keep your healer safe'), t('Move closer to your allies, or pass.'), {icon: 'move'});
            }
        } else if (c.hasEnemy && !this.stats.everAttacked) {
            show(t('Attack'), t('Select an adjacent enemy. Attacking ends your turn.'), {icon: 'attack'});
        } else if (c.spells.length && !this.stats.everUsedSpell) {
            show(t('Cast a spell'), t('Select a spell, then a highlighted target.'), {focus: 'spells', icon: 'spell'});
        } else if (!this.stats.everMoved) {
            show(t('Move'), t('Select a blue tile. Moving ends your turn.'), {icon: 'move'});
        } else if (c.hasItem && !this.stats.everUsedItem) {
            show(t('Use an item'), t('Select an item when you need it. Using it ends your turn.'), {focus: 'items', icon: 'item'});
        } else if (c.poison) {
            show(t('Poisoned'), t('Poison damages this character each turn. An Antidote removes it.'));
        } else {
            // Once the basics are learned, let the arena carry the feedback.
            this.events.emit('hideTutorialMessage');
        }
    }

    destroy() {
        this.ended = true;
        for (const [event, handler] of Object.entries(this.handlers)) this.events.off(event, handler);
    }
}
