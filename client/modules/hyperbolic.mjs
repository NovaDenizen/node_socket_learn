
console.log('hyperbolic.js loaded');

export class Point {
    constructor(reference, r, theta) {
        this.reference = reference; 
        this.r = r;                 // distance from reference
        this.theta = theta;         // bearing from reference
        Object.seal(this);
    }
    static origin() {
        return new Point(null, 0, 0);
    }
}


export function nothing() {
    console.log('hyperbolic.nothing()');
}
