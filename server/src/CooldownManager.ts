export class CooldownManager {
    private cooldown: number = 0;
    private cooldownTimer: NodeJS.Timeout | null = null;
    private remainingTime: number = 0;
    private startTime: number = 0;

    setCooldown(durationMs: number) {
        this.cooldown = durationMs;
        this.remainingTime = durationMs;
        this.startTimer();
    }

    private startTimer() {
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.startTime = Date.now();
        this.cooldownTimer = setTimeout(() => {
            this.cooldown = 0;
            this.remainingTime = 0;
        }, this.remainingTime);
    }

    pauseCooldown() {
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
            this.cooldownTimer = null;
            this.remainingTime -= (Date.now() - this.startTime);
        }
    }

    resumeCooldown() {
        // console.log(`[CooldownManager] Resuming cooldown for ${this.remainingTime}ms`);
        if (this.remainingTime > 0) {
            this.startTimer();
        }
    }

    getCooldownRemaining() {
        return this.remainingTime;
    }

    getCooldown() {
        return this.cooldown;
    }

    clearCooldown() {
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.cooldown = 0;
        this.remainingTime = 0;
    }
}