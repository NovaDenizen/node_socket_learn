import Complex from "./Complex";

export default class ScreenXY {
    readonly x: number;
    readonly y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        Object.freeze(this);
    }
    toComplex(): Complex {
        return new Complex(this.x, this.y);
    }
    static fromComplex(c: Complex) {
        return new ScreenXY(c.a, c.b);
    }
    static zero: ScreenXY = new ScreenXY(0, 0);
    static iBasis: ScreenXY = new ScreenXY(1, 0);
    static jBasis: ScreenXY = new ScreenXY(0, 1);
    add(other: ScreenXY): ScreenXY {
        return new ScreenXY(this.x + other.x, this.y + other.y);
    }
    sub(other: ScreenXY): ScreenXY {
        return new ScreenXY(this.x - other.x, this.y - other.y);
    }
}
