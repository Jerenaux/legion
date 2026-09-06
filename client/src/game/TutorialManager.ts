import { events } from '../components/HUD/GameHUD';
import { EngagementStats } from '@legion/shared/interfaces';

interface TutorialMessage {
    content: string;
    position?: 'bottom' | 'spells' | 'items';
}

export class TutorialManager {
    private engagementStats: Partial<EngagementStats>;
    private messageQueue: TutorialMessage[] = [];
    private isProcessingQueue = false;
    private lastMessageTime: number = 0;
    private readonly MESSAGE_COOLDOWN = 1000;
    private gameEnded = false;

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
            position: 'spells'
        },
        howToUseItem: {
            content: "Click an item icon to use it!",
            position: 'items'
        },
        howToDealWithFlames: {
            content: "Move away from flames to avoid repeated damage!"
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
            content: "You can't cast spells without enough MP!",
            position: 'spells'
        }
    };

    constructor(engagementStats: Partial<EngagementStats>) {
        this.engagementStats = engagementStats || {};
        this.setupEventListeners();
    }

    private setupEventListeners() {
        events.on('performAction', () => {
            events.emit('hideTutorialMessage');
        });
        events.on('turnStarted', () => {
            events.emit('hideTutorialMessage');
        });
        events.on('gameEnd', () => {
            this.gameEnded = true;
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
                    events.on('hasEnemy', () => {
                        this.queueMessage('howToAttack');
                        events.removeAllListeners('hasEnemy');
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

        if (!this.engagementStats.everUsedItem && this.engagementStats.completedGames < 4) {
            events.on('selectCharacter_hasItem', () => {
                this.queueMessage('howToUseItem');
            });
            events.on('playerUseItem', () => {
                this.engagementStats.everUsedItem = true;
                events.removeAllListeners('selectCharacter_hasItem');
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

        if (!this.engagementStats.everPoisoned) {
            events.on('hasStatus_Poison', () => {
                if (this.queueMessage('howToDealWithPoison')) {
                    this.engagementStats.everPoisoned = true;
                    events.removeAllListeners('hasStatus_Poison');
                }
            });
        }

        if (!this.engagementStats.everSilenced) {
            events.on('hasStatus_Mute', () => {
                if (this.queueMessage('howToDealWithSilence')) {
                    this.engagementStats.everSilenced = true;
                    events.removeAllListeners('hasStatus_Mute');
                }
            });
        }

        if (!this.engagementStats.everParalyzed) {
            events.on('hasStatus_Paralyze', () => {
                if (this.queueMessage('howToDealWithParalysis')) {
                    this.engagementStats.everParalyzed = true;
                    events.removeAllListeners('hasStatus_Paralyze');
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
        if (this.gameEnded) return false;
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
            // console.log(`[TutorialManager:queueMessage] Queued message: ${messageKey}`);
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
        events.removeAllListeners('selectCharacter_hasItem');
        events.removeAllListeners('selectCharacter_2');
        events.removeAllListeners('selectCharacter');
        events.removeAllListeners('hasEnemy');
        events.removeAllListeners('playerMoved');
        events.removeAllListeners('playerCastSpell');
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
