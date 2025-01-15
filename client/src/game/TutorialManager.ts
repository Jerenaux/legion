import { events } from '../components/HUD/GameHUD';
import { Arena } from './Arena';
import { EngagementStats } from '@legion/shared/interfaces';

interface TutorialMessage {
    content: string;
    position?: 'top' | 'bottom';
}

export class TutorialManager {
    private arena: Arena;
    private engagementStats: EngagementStats;
    private messageQueue: TutorialMessage[] = [];
    private isProcessingQueue = false;
    private lastMessageTime: number = 0;
    private readonly MESSAGE_COOLDOWN = 1000;

    // Map of events to their corresponding tutorial messages
    private readonly tutorialMessages: Record<string, TutorialMessage> = {
        howToMove: {
            content: "Click on a blue tile to move!"
        },
        howToAttack: {
            content: "Click on an adjacent enemy to attack!"
        },
        howToCastSpell: {
            content: "Click on a spell icon to cast it!",
            position: 'top'
        },
        howToUseItem: {
            content: "Click an item icon to use it!",
            position: 'top'
        },
        howToDealWithFlames: {
            content: "Move away from flames to avoid repeated damage."
        },
        howToBreakIce: {
            content: "Attack ice with another character to break it!"
        },
        howToDealWithPoison: {
            content: "Poison damages you every turn for several turns!"
        },
        howToDealWithSilence: {
            content: "You cannot cast spells while silenced!"
        },
        howToDealWithParalysis: {
            content: "Paralysis prevents you from acting for several turns!"
        },
        howToDealWithLowMP: {
            content: "You can't cast spells without enough MP!"
        }
    };

    constructor(arena: Arena) {
        this.arena = arena;
        // @ts-ignore
        this.engagementStats = {};
        
        // Listen for engagement stats updates
        events.on('updateEngagementStats', (stats: EngagementStats) => {
            // @ts-ignore
            this.engagementStats = stats || {};
            this.setupEventListeners();
        });
        
        // Request engagement stats
        events.emit('requestEngagementStats');
    }

    private setupEventListeners() {
        events.on('performAction', () => {
            events.emit('hideTutorialMessage');
        });

        if (!this.engagementStats.everMoved) {
            events.on('selectCharacter', () => {
                this.queueMessage('howToMove');
            });
            events.on('playerMoved', () => {
                this.engagementStats.everMoved = true;
                events.removeAllListeners('selectCharacter');

                if (!this.engagementStats.everAttacked) {
                    console.log('Adding playerAttacked listener');
                    events.on('selectCharacter', () => {
                        this.queueMessage('howToAttack');
                        events.removeAllListeners('selectCharacter');
                    });
                    events.on('playerAttacked', () => {
                        this.engagementStats.everAttacked = true;
                    });
                }

                events.removeAllListeners('playerMoved');
            });
        }

        // Spells and items
        if (!this.engagementStats.everUsedSpell) {
            events.on('selectCharacter_2', () => {
                this.queueMessage('howToCastSpell');
            });
            events.on('playerCastSpell', () => {
                this.engagementStats.everUsedSpell = true;
                events.removeAllListeners('selectCharacter_2');
            });
        }

        if (!this.engagementStats.everUsedItem) {
            events.on('selectCharacter_hasItems', () => {
                this.queueMessage('howToUseItem');
            });
            events.on('playerUseItem', () => {
                this.engagementStats.everUsedItem = true;
                events.removeAllListeners('selectCharacter_hasItems');
            });
        }

        // Environmental effects
        if (!this.engagementStats.everSawFlames) {
            events.on('hasFlame', () => {
                if (this.queueMessage('howToDealWithFlames')) {
                    this.engagementStats.everSawFlames = true;
                    events.removeAllListeners('hasFlame');
                }
            });
        }

        if (!this.engagementStats.everSawIce) {
            events.on('hasIce', () => {
                if (this.queueMessage('howToDealWithIce')) {
                    this.engagementStats.everSawIce = true;
                    events.removeAllListeners('hasIce');
                }
            });
        }

        // Status effects
        if (!this.engagementStats.everPoisoned) {
            events.on('hasStatus_POISON', () => {
                if (this.queueMessage('howToDealWithPoison')) {
                    this.engagementStats.everPoisoned = true;
                    events.removeAllListeners('hasStatus_POISON');
                }
            });
        }

        if (!this.engagementStats.everSilenced) {
            events.on('hasStatus_MUTE', () => {
                if (this.queueMessage('howToDealWithSilence')) {
                    this.engagementStats.everSilenced = true;
                    events.removeAllListeners('hasStatus_MUTE');
                }
            });
        }

        if (!this.engagementStats.everParalyzed) {
            events.on('hasStatus_PARALYZE', () => {
                if (this.queueMessage('howToDealWithParalysis')) {
                    this.engagementStats.everParalyzed = true;
                    events.removeAllListeners('hasStatus_PARALYZE');
                }
            });
        }

        if (!this.engagementStats.everLowMP) {
            events.on('hasLowMP', () => {
                if (this.queueMessage('howToDealWithLowMP')) {
                    this.engagementStats.everLowMP = true;
                    events.removeAllListeners('hasLowMP');
                }
            });
        }
    }

    private queueMessage(messageKey: string) {
        // console.log(`[TutorialManager:queueMessage] Attempting to queue message: ${messageKey}`);
        const now = Date.now();
        
        // Check if enough time has passed since the last message
        if (now - this.lastMessageTime < this.MESSAGE_COOLDOWN) {
            // console.log(`[TutorialManager:queueMessage] Skipping message: too soon after last message`);
            return false; // Return false to indicate message wasn't queued
        }

        const message = this.tutorialMessages[messageKey];
        if (message) {
            this.messageQueue.push(message);
            this.lastMessageTime = now;
            this.processMessageQueue();
            return true; // Return true to indicate message was queued
        }
        return false;
    }

    private async processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;

        this.isProcessingQueue = true;
        const message = this.messageQueue.shift();
        events.emit('showTutorialMessage', message);
        
        this.isProcessingQueue = false;
        this.processMessageQueue();
    }

    destroy() {
        // Add cleanup for the new event listener
        events.removeAllListeners('updateEngagementStats');
        
        // Clean up all event listeners
        events.removeAllListeners('selectCharacter');
        events.removeAllListeners('playerMoved');
        events.removeAllListeners('playerAttacked');
        events.removeAllListeners('selectedSpell');
        events.removeAllListeners('playerUseItem');
        events.removeAllListeners('flamesAppeared');
        events.removeAllListeners('iceAppeared');
        events.removeAllListeners('hasStatus_POISON');
        events.removeAllListeners('hasStatus_MUTE');
        events.removeAllListeners('hasStatus_PARALYZE');
    }
} 
