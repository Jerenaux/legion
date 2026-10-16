import {recoveryTime} from '@legion/shared/combatBalance';
import { SpeedClass, Stat } from "@legion/shared/enums";
import { ServerPlayer } from "./ServerPlayer";

interface TurnQueueItem {
    character: ServerPlayer;
    nextActionTime: number;
    passCount: number;
    tieBreaker: number;
}

export class TurnSystem {
    private currentTime: number;
    private turnQueue: TurnQueueItem[];

    constructor() {
        this.currentTime = 0;
        this.turnQueue = [];
    }

    // When initializing combat, compute initial turn order
    initializeTurnOrder(characters: ServerPlayer[], openingOrder?: ServerPlayer[]) {
        this.turnQueue = characters.map(char => ({
            character: char,
            nextActionTime: openingOrder ? 1001 + openingOrder.indexOf(char) : this.getInitialActionTime(char.getStat(Stat.SPEED)),
            tieBreaker: Math.random(),
            passCount: 0
        }));
        
        // Sort by nextActionTime ascending
        this.sortQueue();
    }

    getInitialActionTime(speed) {
        // Higher speed gives earlier initiative without randomizing recovery time.
        return recoveryTime(speed, SpeedClass.NORMAL);
    }

    // After a character takes an action
    processAction(character: ServerPlayer, actionType: SpeedClass) {
        const queueItem = this.turnQueue.find(c => c.character === character);
        if (!queueItem) return;

        let timeIncrement = recoveryTime(character.getStat(Stat.SPEED), actionType, character.isHasted());
        // Find the next fastest actor's time (for all actions)
        const otherActors = this.turnQueue.filter(item => 
            item.character !== character && 
            item.character.isAlive()
        );
        
        if (otherActors.length > 0) {
            const nextFastestTime = Math.min(...otherActors.map(item => item.nextActionTime));
            // Ensure we go after the next fastest actor
            const minimumNextTime = nextFastestTime + 1;
            const requiredIncrement = minimumNextTime - this.currentTime;
            timeIncrement = Math.max(timeIncrement, requiredIncrement);
        }
        
        // Handle pass count
        if (actionType === SpeedClass.PASS) {
            queueItem.passCount++;
        } else {
            queueItem.passCount = 0;
        }
        
        queueItem.nextActionTime = this.currentTime + timeIncrement;
        // Redraw on every reschedule: a fixed draw would let one unit win every later tie.
        queueItem.tieBreaker = Math.random();
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
        // Fixed class speeds must not give the first-listed team every tied activation.
        this.turnQueue.sort((a, b) => (a.nextActionTime - b.nextActionTime) || (a.tieBreaker - b.tieBreaker));
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

    addCharacter(character: ServerPlayer) {
        this.turnQueue.push({
            character: character,
            nextActionTime: this.currentTime + this.getInitialActionTime(character.getStat(Stat.SPEED)),
            tieBreaker: Math.random(),
            passCount: 0
        });
        this.sortQueue();
    }
}