
export default class ScreenXY {
    readonly x: number;
    readonly y: number;
    constructor(x: number = 0, y: number = 0) {
        this.x = x || 0;
        this.y = y || 0;
        Object.freeze(this);
    }
}
