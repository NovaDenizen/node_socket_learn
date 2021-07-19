
import ScreenXY from "./ScreenXY";

// represents an affine transform over screen coordinates.
// This is an immutable object.
//
// This transform is best viewed as a matrix, with 6 real parameters a through f.
// f(t) = [ a  b  c ] [ t.a ]
//        [ d  e  f ] [ t.b ]
//        [ 0  0  1 ] [ 1   ]
export default class AffXform {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly e: number;
    readonly f: number;
    constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
    }
    xform(q: ScreenXY): ScreenXY {
        return new ScreenXY(this.a * q.x + this.b * q.y + this.c,
                            this.d * q.x + this.e * q.y + this.f);
    }
    // this.xform(other.xform(q)) === (this.compose(other)).xform(q)
    compose(other: AffXform): AffXform {
        const o = this.xform(other.xform(ScreenXY.zero));
        const i = this.xform(other.xform(ScreenXY.iBasis)).sub(o);
        const j = this.xform(other.xform(ScreenXY.jBasis)).sub(o);
        return new AffXform(i.x, j.x, o.x, i.y, j.y, o.y);
    }
    static translate(o: ScreenXY): AffXform {
        return new AffXform(1, 0, o.x, 0, 1, o.y);
    }
    static rotate(radians: number): AffXform {
        const sin = Math.sin(radians);
        const cos = Math.cos(radians);
        return new AffXform(cos, sin, 0, -sin, cos, 0);
    }
    static flipX: AffXform = new AffXform(-1, 0, 0, 0, 1, 0);
    static flipY: AffXform = new AffXform(1, 0, 0, 0, -1, 0);
        static scale(xscale: number, yscale: number): AffXform {
        return new AffXform(xscale, 0, 0, 0, yscale, 0);
    }
    static identity: AffXform = new AffXform(1, 0, 0, 0, 1, 0);
    invert(): AffXform {
        // f(t) = [ a  b  c ] [ t.a ]
        //        [ d  e  f ] [ t.b ]
        //        [ 0  0  1 ] [ 1   ]
        const det = this.a * this.e - this.b * this.d;
        const det_inv = 1.0/det;
        // [ a  b  c ] [ a' b' c' ]   [ 1 0 0 ]
        // [ d  e  f ] [ d' e' f' ] = [ 0 1 0 ]
        // [ 0  0  1 ] [ 0  0  1  ]   [ 0 0 1 ]

        // a * a' + b * d' = 1
        // d * a' + e * d' = 0
        const new_a = this.e * det_inv;
        const new_d = -this.d * det_inv;

        // a * b' + b * e' = 0
        // d * b' + e * e' = 1
        const new_b = -this.b * det_inv;
        const new_e = this.a * det_inv;

        // a * c' + b * f' + c = 0
        // d * c' + e * f' + f = 0
        // a * c' + b * f' = -c
        // d * c' + e * f' = -f
        const new_c = (-this.c*this.e + this.f*this.b) * det_inv;
        const new_f = (- this.a*this.f + this.d * this.c) * det_inv;
        return new AffXform(new_a, new_b, new_c, new_d, new_e, new_f);
    }
    // sends (0,0) to a, (1, 0) to b, and (0, 1) to c
    static from_zij(a: ScreenXY, b: ScreenXY, c: ScreenXY): AffXform {
        // transform that sends a to 0 and b to 1 and c to i is the inverse
        // of the one that sends 0 to a, 1 to b, and i to c.
        // we're looking for R, where R^-1 = A and A satisfies:

        const new_c = a.x;
        const new_f = a.y;
        // [ a b c ][ 1 ] = [ b.x ]
        // [ d e f ][ 0 ] = [ b.y ]
        //          [ 1 ] = 
        // a + c = b.x
        // d + f = b.y
        const new_a = b.x - new_c;
        const new_d = b.y - new_f;

        // [ a b c ][ 0 ] = [ c.x ]
        // [ d e f ][ 1 ] = [ c.y ]
        const new_b = c.x - new_c;
        const new_e = c.y - new_f;
        return new AffXform(new_a, new_b, new_c, new_d, new_e, new_f);
    }
    // sends a1, b1, and c1 to a2, b2, and c2 respectively
    static threePoint(a1: ScreenXY, b1: ScreenXY, c1: ScreenXY, 
                      a2: ScreenXY, b2: ScreenXY, c2: ScreenXY): AffXform
    {
        // A (0, i, j) = (a1, b1, c1) 
        // B (0, i, j) = (a2, b2, c2)
        // A^-1(a1, b1, c1) = (0, i, j)
        // (B . A^-1)(a1, b1, c1) = (a2, b2, c2)
        const tA = AffXform.from_zij(a1, b1, c1);
        const tB = AffXform.from_zij(a2, b2, c2);
        const tRes = tB.compose(tA.invert());
        return tRes;
    }
    det(): number {
        return (this.a * this.e - this.d * this.b);
    }
    scale(): number {
        return Math.sqrt(Math.abs(this.det()));
    }
    // works like this.inverse.xform(p), except it doesn't allocate anything.
    inverseXform(p: ScreenXY): ScreenXY {
        const det = this.a * this.e - this.b * this.d;
        // a * r.x + b * r.y + c = p.x
        // d * r.x + e * r.y + f = p.y
        const resX = ((p.x - this.c) * this.e - (p.y - this.f)* this.b)/det;
        const resY = (this.a * (p.y - this.f) - this.d*(p.x - this.c))/det;
        return new ScreenXY(resX, resY);
    }
    // TODO: static shearX() {...} and static shearY() {...}?
}
