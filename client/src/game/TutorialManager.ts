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
    pendingSpell?: boolean;
    pendingItem: boolean;
    ice: boolean;
    fire?: boolean;
    poison?: boolean;
    muted?: boolean;
    paralyzed?: boolean;
    lowMP?: boolean;
    hasItem?: boolean;
}

export interface TutorialMessage {
    title: string;
    content: string;
    focus?: 'spells' | 'items' | 'timeline';
    learned: number;
    icon?: 'move' | 'attack' | 'spell' | 'item' | 'turn';
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
    private shownThisTurn = new Map<keyof EngagementStats, number>();
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
        // Keep a newly seen situation visible for this turn, without repeating it in later turns.
        const unseen = (flag: keyof EngagementStats) => !this.stats[flag] || this.shownThisTurn.get(flag) === c.turn;
        const situation = (flag: keyof EngagementStats, title: string, content: string, detail: Partial<TutorialMessage> = {}) => {
            this.stats = {...this.stats, [flag]: true};
            this.shownThisTurn.set(flag, c.turn);
            show(title, content, detail);
        };
        if (this.actionTurn === c.turn) {
            this.events.emit('hideTutorialMessage');
        } else if (!c.selectedIsTurnee) {
            show(t('{{name}} acts now', {name: c.name}), t('Select the active character.'), {focus: 'timeline', icon: 'turn'});
        } else if (c.pendingSpell || c.pendingItem) {
            this.events.emit('hideTutorialMessage');
        } else if (c.ice && unseen('everSawIce')) {
            situation('everSawIce', t('Frozen in ice'), t('Attack ice with another character to break it!'), {icon: 'attack'});
        } else if (c.paralyzed && unseen('everParalyzed')) {
            situation('everParalyzed', t('Paralysis'), t('Paralysis prevents you from acting for several turns!'));
        } else if (!c.canAct) {
            this.events.emit('hideTutorialMessage');
        } else if (c.fire && unseen('everSawFlames')) {
            situation('everSawFlames', t('Flames'), t('Move away from flames to avoid repeated damage!'), {icon: 'move'});
        } else if (c.poison && unseen('everPoisoned')) {
            situation('everPoisoned', t('Poison'), t('Poison damages you every turn for several turns!'));
        } else if (c.muted && unseen('everSilenced')) {
            situation('everSilenced', t('Silence'), t('You cannot cast spells while silenced!'));
        } else if (c.lowMP && unseen('everLowMP')) {
            situation('everLowMP', t('Low mana'), t("You can't cast spells without enough MP!"), {focus: 'spells', icon: 'spell'});
        } else if (c.hasEnemy && !this.stats.everAttacked) {
            show(t('Attack'), t('Click on an adjacent enemy to attack!'), {icon: 'attack'});
        } else if (c.hasSpells && c.spellInRange && !this.stats.everUsedSpell) {
            show(t('Spells'), t('Click on a spell icon to cast it!'), {focus: 'spells', icon: 'spell'});
        } else if (!this.stats.everMoved) {
            show(t('Move'), t('Click on a blue tile to move!'), {icon: 'move'});
        } else if (c.hasItem && !this.stats.everUsedItem) {
            show(t('Items'), t('Click an item icon to use it!'), {focus: 'items', icon: 'item'});
        } else {
            this.events.emit('hideTutorialMessage');
        }
    }

    destroy() {
        this.ended = true;
        for (const [event, handler] of Object.entries(this.handlers)) this.events.off(event, handler);
    }
}
