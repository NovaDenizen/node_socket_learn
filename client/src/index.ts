
import Complex from './complex';

console.log('index.ts loaded');


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
}


export function nothing() {
    console.log('index.nothing()');
}

const x = new Complex(3, 4);

console.log(`x = ${x}`);
