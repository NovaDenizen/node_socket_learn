import Complex from "./Complex";

export default class ScreenXY {
    readonly x: number;
    readonly y: number;
    constructor(x: number = 0, y: number = 0) {
        this.x = x || 0;
        this.y = y || 0;
        Object.freeze(this);
    }
    toComplex(): Complex {
        return new Complex(this.x, this.y);
    }
    static fromComplex(c: Complex) {
        return new ScreenXY(c.a, c.b);
    }
}
