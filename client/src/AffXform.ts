
import Complex from "./Complex";

// represents an affine transform over complex numbers with complex parameters x, y, and o:
// This is an immutable object.
//
// f(a + bi) = ax + by + o
// you can alwo view it like a matrix:
// f(t) = [ x.a  y.a  o.a ] [ t.a ]
//        [ x.b  y.b  o.b ] [ t.b ]
//        [ 0    0    1   ] [ 1   ]
export default class AffXform {
    readonly x: Complex;
    readonly y: Complex;
    readonly o: Complex;
    constructor(x: Complex | undefined, y: Complex | undefined, o: Complex | undefined) {
        if (x === undefined) {
            x = Complex.zero;
        }
        if (y === undefined) {
            y = Complex.zero;
        }
        if (o === undefined) {
            o = Complex.zero;
        }
        this.x = x;
        this.y = y;
        this.o = o;
        Object.freeze(this);
    }
    xform(q: Complex): Complex {
        return this.x.scale(q.a).add(this.y.scale(q.b)).add(this.o);
    }
    // this.xform(other.xform(q)) === (this.compose(other)).xform(q)
    compose(other: AffXform): AffXform {
        const o = this.xform(other.xform(Complex.zero));
        const x = this.xform(other.xform(Complex.one)).sub(o);
        const y = this.xform(other.xform(Complex.i)).sub(o);
        return new AffXform(x, y, o);
    }
    static translate(o: Complex): AffXform {
        return new AffXform(Complex.one, Complex.i, o);
    }
    static rotate(radians: number): AffXform {
        const sin = Math.sin(radians);
        const cos = Math.cos(radians);
        const x = new Complex(cos, sin);
        const y = new Complex(-sin, cos);
        return new AffXform(x, y, Complex.zero);
    }
    static flipX: AffXform = new AffXform(Complex.one.neg(), Complex.i, Complex.zero);
    static flipY: AffXform = new AffXform(Complex.one, Complex.i.neg(), Complex.zero);
    static scale(xscale: number, yscale: number): AffXform {
        return new AffXform(new Complex(xscale, 0), new Complex(0, yscale), Complex.zero);
    }
    static identity: AffXform = new AffXform(Complex.one, Complex.i, Complex.zero);
    invert(): AffXform {
        // f(t) = [ x.a  y.a  o.a ] [ t.a ]
        //        [ x.b  y.b  o.b ] [ t.b ]
        //        [ 0    0    1   ] [ 1   ]
        const det = this.x.a * this.y.b - this.x.b * this.y.a;
        const det_inv = 1.0/det;
        // [ x.a  y.a  o.a ] [ x'.a  y'.a  o'.a ]   [ 1 0 0 ]
        // [ x.b  y.b  o.b ] [ x'.b  y'.b  o'.b ] = [ 0 1 0 ]
        // [ 0    0    1   ] [ 0     0     1    ]   [ 0 0 1 ]

        // x.a * x'.a + y.a*x'.b = 1
        // x.b * x'.a + y.b*x'.b = 0
        // [ x.a y.a ] [ x'.a ] = [ 1 ]
        // [ x.b y.b ] [ x'.b ] = [ 0 ]
        const new_x = new Complex(this.y.b * det_inv, this.x.b * det_inv);

        // x.a * y'.a + y.a * y'.b = 0
        // x.b * y'.a + y.b * y'.b = 1
        const new_y = new Complex(-this.y.a*det_inv, this.x.a*det_inv);
        // x.a * o'.a + y.a * o'.b + o.a = 0
        // x.b * o'.a + y.b * o'.b + o.b = 0
        // [ x.a  y.a ] [ o'.a ] = [ -o.a ]
        // [ x.b  y.b ] [ o'.b ] = [ -o.b ]
        // o'.a = | -o.a y.a |
        //        | -o.b y.b | / det
        const new_o_a = (-this.o.a * this.y.b + this.y.a * this.o.b)* det_inv;
        // o'.b = | x.a -o.a |
        //        | x.b -o.b | / det
        const new_o_b = (-this.x.a*this.o.b + this.x.b*this.o.a) * det_inv;
        const new_o = new Complex(new_o_a, new_o_b);
        return new AffXform(new_x, new_y, new_o);
    }
}
