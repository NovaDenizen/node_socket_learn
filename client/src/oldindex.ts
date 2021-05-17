
import Complex from "./complex";


export class Point {
    reference?: Point;
    r: number;
    theta: number;
    constructor(r: number, theta: number, reference?: Point) {
        this.reference = reference;
        this.r = r;                 // distance from reference
        this.theta = theta;         // bearing from reference
        Object.freeze(this);
    }
    static origin() {
        return new Point(0, 0);
    }
};

export function make_x(): Complex {
    return new Complex(2, 3);
};

export function nothing() {
    return 'index.nothing()';
};

export { Complex };

