

export default class FrameStatus {
    private _statusPeriodMs: number = 5000;
    private frameDurations: number[] = [];
    private frameStart: number | undefined = undefined;
    logger: ((s: string) => void) | undefined;
    interval: number | undefined;
    startFrame(): void {
        if (this.frameStart !== undefined) {
            throw new Error("this.frameStart !== undefined in startFrame");
        }
        this.frameStart = new Date().getTime();
    }
    endFrame(): void {
        if (this.frameStart === undefined) {
            throw new Error("this.frameStart === undefinned in endFrame");
        }
        const now = new Date().getTime();
        const interval = now - this.frameStart;
        this.frameDurations.push(interval);
        this.frameStart = undefined;
    }
    private clearInterval(): void {
        if (this.interval !== undefined) {
            window.clearInterval(this.interval);
            this.interval = undefined;
        }
    }
    private initInterval(): void {
        this.interval = window.setInterval(this.sendStatus.bind(this), this._statusPeriodMs);
    }
    set statusPeriodMs(n: number) {
        this._statusPeriodMs = n;
        this.sendStatus();
        this.log(`updated interval to ${n}ms`);
    }
    get statusPeriodMs(): number {
        return this._statusPeriodMs;
    }
    log(s: string) {
        if (this.logger) {
            this.logger(s);
        }
    }
    constructor() {
        this.logger = undefined;
        this.interval = undefined;
        Object.seal(this);
        this.initInterval();
    }
    private sendStatus() {
        let sum = 0;
        for (const d of this.frameDurations) {
            sum += d;
        }
        const nf = this.frameDurations.length;
        if (nf > 0) {
            const avg = sum / nf;
            this.log(`frameStatus: ${nf} frames, avg ${avg}ms}`);
            this.frameDurations = [];
        }
    }
}
