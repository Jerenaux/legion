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
    hasSpells: boolean;
    spellInRange: boolean;
    pendingSpell?: { name: string; hasTarget: boolean };
    pendingItem: boolean;
    ice: boolean;
}

export interface TutorialMessage {
    title: string;
    content: string;
    focus?: 'spells' | 'timeline';
    learned: number;
    icon?: 'move' | 'attack' | 'spell' | 'turn';
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
    private timelineTurn = -1;
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
        if (!this.stats.everMoved && !this.stats.everAttacked && !this.stats.everUsedSpell && !this.stats.everUsedItem) {
            this.timelineTurn = this.context?.turn ?? -1;
        }
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
        if (this.actionTurn === c.turn) {
            if (this.timelineTurn === c.turn) {
                show(t('Turn order'), t('The portraits show who acts next. Faster actions bring your next turn sooner.'), {focus: 'timeline', icon: 'turn'});
            } else this.events.emit('hideTutorialMessage');
        } else if (!c.selectedIsTurnee) {
            show(t('{{name}} acts now', {name: c.name}), t('Select the active character.'), {focus: 'timeline', icon: 'turn'});
        } else if (c.pendingSpell && !this.stats.everUsedSpell) {
            show(t('Aim {{spell}}', {spell: t(c.pendingSpell.name)}), c.pendingSpell.hasTarget
                ? t('The colored tiles show range. Select a target, or select the spell again to cancel.')
                : t('No target in range. Select the spell again to cancel, then move closer.'), {icon: 'spell'});
        } else if (c.pendingSpell || c.pendingItem) {
            this.events.emit('hideTutorialMessage');
        } else if (c.ice) {
            show(t('Frozen in ice'), t('Another character can attack the ice to break it.'));
        } else if (!c.canAct) {
            this.events.emit('hideTutorialMessage');
        } else if (!this.stats.everMoved && !this.stats.everAttacked && !this.stats.everUsedSpell && !this.stats.everUsedItem) {
            show(t('One action per turn'), t('Select a blue tile. Moving ends your turn.'), {icon: 'move'});
        } else if (c.hasSpells && !this.stats.everUsedSpell) {
            if (c.spellInRange) {
                show(t('Spell controls'), t('Select a spell in the bar below to show its range.'), {focus: 'spells', icon: 'spell'});
            } else {
                show(t('Out of range'), t('Move closer this turn to bring a target into spell range.'), {icon: 'move'});
            }
        } else if (c.hasEnemy && !this.stats.everAttacked) {
            show(t('Attack'), t('Select an adjacent enemy. Attacking ends your turn.'), {icon: 'attack'});
        } else {
            this.events.emit('hideTutorialMessage');
        }
    }

    destroy() {
        this.ended = true;
        for (const [event, handler] of Object.entries(this.handlers)) this.events.off(event, handler);
    }
}
