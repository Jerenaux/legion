// Recovery freezes casts, AI decisions and turn expiry together.
export class CombatClock {
    private jobs = new Map<number, {callback: () => void; due: number; generation: number; timer?: ReturnType<typeof setTimeout>}>();
    private nextId = 0;
    private stoppedAt: number | null = null;
    private pausedDuration = 0;
    private disposed = false;

    get paused() { return this.stoppedAt !== null; }
    now() { return (this.stoppedAt ?? performance.now()) - this.pausedDuration; }

    schedule(callback: () => void, delayMs: number) {
        const id = ++this.nextId;
        if (this.disposed) return id;
        this.jobs.set(id, {callback, due: this.now() + delayMs, generation: 0});
        if (!this.paused) this.arm(id);
        return id;
    }

    cancel(id: number | null) {
        const job = this.jobs.get(id);
        if (job) clearTimeout(job.timer);
        this.jobs.delete(id);
    }

    private arm(id: number) {
        const job = this.jobs.get(id)!;
        const generation = ++job.generation;
        job.timer = setTimeout(() => {
            if (this.paused || this.disposed || !this.jobs.has(id) || generation !== job.generation) return;
            this.jobs.delete(id);
            job.callback();
        }, Math.max(0, job.due - this.now()));
    }

    pause() {
        if (this.paused || this.disposed) return;
        this.stoppedAt = performance.now();
        for (const job of this.jobs.values()) clearTimeout(job.timer);
    }

    resume() {
        if (!this.paused || this.disposed) return;
        this.pausedDuration += performance.now() - this.stoppedAt!;
        this.stoppedAt = null;
        for (const id of this.jobs.keys()) this.arm(id);
    }

    dispose() {
        this.disposed = true;
        for (const job of this.jobs.values()) clearTimeout(job.timer);
        this.jobs.clear();
    }
}
