

export default class FrameStatus {
    // at what interval should the status messages be sent?
    private _statusPeriodMs: number = 5000;
    // stores all frame draw durations in the last interval
    private frameDurations: number[] = [];
    // when did the last frame start
    private frameStart: number | undefined = undefined;
    // where do status messages go?
    logger: ((s: string) => void) | undefined;
    // the id used by window.setInterval and window.clearInterval
    private interval: number | undefined;

    // call this when a fraem begins to draw
    startFrame(): void {
        if (this.frameStart !== undefined) {
            throw new Error("this.frameStart !== undefined in startFrame");
        }
        this.frameStart = new Date().getTime();
    }
    // call then when a frame is done drawing
    endFrame(): void {
        if (this.frameStart === undefined) {
            throw new Error("this.frameStart === undefinned in endFrame");
        }
        const now = new Date().getTime();
        const interval = now - this.frameStart;
        this.frameDurations.push(interval);
        this.frameStart = undefined;
    }
    // get rid of the interval callback
    private clearInterval(): void {
        if (this.interval !== undefined) {
            window.clearInterval(this.interval);
            this.interval = undefined;
        }
    }
    // create the interval callback
    private initInterval(): void {
        this.interval = window.setInterval(this.sendStatus.bind(this), this._statusPeriodMs);
    }
    // setter for _statusPeriodMs
    set statusPeriodMs(n: number) {
        this._statusPeriodMs = n;
        this.sendStatus();
        this.clearInterval();
        this.initInterval();
        this.log(`updated interval to ${n}ms`);
    }
    // getter for _statusPeriodMs
    get statusPeriodMs(): number {
        return this._statusPeriodMs;
    }
    // use this.logger, if it is present
    private log(s: string) {
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
    // send out a status message based on the frames that have been drawn in the last interval
    private sendStatus() {
        const nf = this.frameDurations.length;
        if (nf > 0) {
            let sum = 0;
            for (const d of this.frameDurations) {
                sum += d;
            }
            const avg = sum / nf;
            this.log(`frameStatus: ${nf} frames, avg ${avg}ms}`);
            this.frameDurations.length = 0;
        }
    }
}
