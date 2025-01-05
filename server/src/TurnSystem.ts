import { SpeedClass, Stat } from "@legion/shared/enums";
import { ServerPlayer } from "./ServerPlayer";

interface TurnQueueItem {
    character: ServerPlayer;
    nextActionTime: number;
    passCount: number;
}

const ACTION_COOLDOWNS = {
    [SpeedClass.PASS]: 60,      // Base cooldown for passing
    [SpeedClass.FAST]: 100,    
    [SpeedClass.NORMAL]: 150,   
    [SpeedClass.SLOW]: 250      
};

export class TurnSystem {
    private currentTime: number;
    private turnQueue: TurnQueueItem[];

    constructor() {
        this.currentTime = 0;
        this.turnQueue = [];
    }

    // When initializing combat, compute initial turn order
    initializeTurnOrder(characters: ServerPlayer[]) {
        this.turnQueue = characters.map(char => ({
            character: char,
            nextActionTime: this.getInitialActionTime(char.getStat(Stat.SPEED)),
            passCount: 0
        }));
        console.log(`[TurnSystem:initializeTurnOrder] ${this.turnQueue.map(item => item.character.getStat(Stat.SPEED)).join(', ')}`);
        
        // Sort by nextActionTime ascending
        this.sortQueue();
    }

    getInitialActionTime(speed) {
        // Higher speed = lower initial action time
        // Base value of 1001 gives us room for variation
        return 1001 - (speed * 5);
    }

    // After a character takes an action
    processAction(character: ServerPlayer, actionType: SpeedClass) {
        const queueItem = this.turnQueue.find(c => c.character === character);
        if (!queueItem) return;

        // Get base cooldown for the action
        const baseCooldown = ACTION_COOLDOWNS[actionType];
        
        const charSpeed = character.getStat(Stat.SPEED);
        
        // Compute new action time:
        // - Start from current time
        // - Add cooldown modified by speed (faster characters recover faster)
        // - Add small random factor to prevent perfect loops
        const speedMultiplier = 1 - (charSpeed * 0.002); // Speed reduces cooldown by 0.2% per point
        const randomVariation = Math.random() * 10 - 5; // ±5 variation
        const timeIncrement = (baseCooldown * speedMultiplier) + randomVariation;
        
        queueItem.nextActionTime = this.currentTime + timeIncrement;

        // For PASS specifically, add an increasing penalty for consecutive passes
        // if (actionType === SpeedClass.PASS) {
        //     queueItem.passCount++;
        //     queueItem.nextActionTime += (queueItem.passCount * 25); // Each consecutive pass adds 25 to cooldown
        // } else {
        //     queueItem.passCount = 0;
        // }

        this.sortQueue();
    }

    // Get the next character that can act
    getNextActor(): ServerPlayer {
        if (this.turnQueue.length === 0) return null;

        // Get the first character that is alive
        const aliveQueue = this.turnQueue.filter(item => item.character.isAlive());
        if (aliveQueue.length === 0) return null;
        
        // Advance time to next action
        this.currentTime = aliveQueue[0].nextActionTime;
        return aliveQueue[0].character;
    }

    sortQueue() {
        this.turnQueue.sort((a, b) => a.nextActionTime - b.nextActionTime);
    }

    getQueueData() {
        return this.turnQueue.filter(item => item.character.isAlive()).map((item, i) => {
            return {
                num: item.character.num,
                team: item.character.team.id,
                position: i,
            }
        });
    }
}