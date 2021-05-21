import Complex from "./Complex";


export default class Xform {
    // represents a Möbius transform over complex numbers of the form f(z) = (a*z + b)/(c*z + d) 
    // with the condition ad - bc != 0.

    // This sort of thing also needs the domaain to be augmented by a "point at infinity", which 
    // follows the rules that ∞ == x / 0 (given x != 0), and x / ∞ == 0.
    readonly a: Complex;
    readonly b: Complex;
    readonly c: Complex;
    readonly d: Complex;
    xform(discPoint: Complex): Complex {
        return (discPoint.mul(this.a).add(this.b)).div(discPoint.mul(this.c).add(this.d));
    }
    constructor(a: Complex, b: Complex, c: Complex, d: Complex) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        Object.freeze(this);
    }
    // this.compose(other).xform(x) === this.xform(other.xform(x))
    compose(other: Xform): Xform {
        // wikipedia tells me this is equivaent to matrix multiplication, but
        // I'm not sure I believe it.
        return new Xform(
            //this.a * other.a + this.b * other.c,
            this.a.mul(other.a).add(this.b.mul(other.c)),
            //this.a * other.b + this.b * other.d,
            this.a.mul(other.b).add(this.b.mul(other.d)),
            //this.c * other.a + this.d * other.c,
            this.c.mul(other.a).add(this.d.mul(other.c)),
            //this.d * other.b + this.d * other.d
            this.c.mul(other.b).add(this.d.mul(other.d))
        );
    }
    det(): Complex {
        return this.a.mul(this.d).sub(this.b.mul(this.c)); 
    }
    invert(): Xform {
        /*
            Kramer's rule: when you want to find (x,y) such that
                [ a b ][ x ] = [ e ]
                [ c d ][ y ]   [ f ]

                let det(a,b,c,d) = ad - bc.
                then x = det(e,b,f,d) / det(a,b,c,d) and y = det(a,e,c,f)/det(a,b,c,d)

                We can use this to invert a matrix, using (e,f) = (1,0) to get the first column, and
                (e,f) = (0,1) to get the second.

                Both use the same q=det(a,b,c,d).

                res = [ det(1,b,0,d)    det(0,b,1,d) ] / q
                      [ det(a,1,c,0)    det(a,0,c,1) ]

                    = [ d   -b ] / q
                      [ -c   a ]
         */
        const invQ: Complex = this.det().invert();
        return new Xform(
            this.d.mul(invQ), 
            this.b.neg().mul(invQ),
            this.c.neg().mul(invQ),
            this.a.mul(invQ)
        );
    }
    // creates a Xform that sends z1 to 0, z2 to 1, and z3 to ∞
    static zeroOneInf(z1: Complex, z2: Complex, z3: Complex): Xform {
        return new Xform(
            z2.sub(z3),
            z1.mul(z2.sub(z3)).neg(),
            z2.sub(z1),
            z3.mul(z2.sub(z1)).neg()
        );
    }
    /// maps complex points z1, z2, z3 to w1, w2, w3
    static threePoint(z1: Complex, z2: Complex, z3: Complex,
                      w1: Complex, w2: Complex, w3: Complex): Xform {
        let h1 = Xform.zeroOneInf(z1, z2, z3);
        let h2 = Xform.zeroOneInf(w1, w2, w3);
        return h2.invert().compose(h1); // sends (z1, z2, z3) to (0,1,∞), then to (w1, w2, w3);
    }
    // sends a point p to the origin, sends the origin to -p, 
    // and keeps the ideal points in line with p immobile
    static pointToOrigin(p: Complex): Xform {
        // assume 0 < |p| < 1
        // a*p + b == 0
        // (a*0 + b) / (c*0 + d) == -p
        // let p' = p/|p|
        // (a*p' + b)/(c*p' + d) = p'

        // b/d = -p
        // b/a = -p
        // so a == d.
        // assume a == 1.
        // b == -p
        // (p' - p)/(c*p' + 1) = p'
        // (p' - p)/p' = c*p' + 1
        // (p/|p| - p)/(p/|p|) = c*p/|p| + 1
        // (p - p|p|)/p = c*p/|p| + 1
        // 1 - |p| = c*p/|p| + 1
        // -|p|= c*p/|p|
        // -|p|^2 = c*p
        // p * p.complement() = |p|^2
        // -(p * p.complement()) = c*p
        // -p.complement() = c

        // so xform is (z - p)/(-p.complement()*z + 1)
        // it sends 0 to -p
        // it sends p to 0
        // it sends p/|p| to (p/|p| - p)/(-p.complement()*p/|p| + 1)
        //                   (p/|p| - p)/(-|p|^2/|p| + 1)
        //                   (p/|p| - p)/(-|p| + 1)
        //                   p/|p|(1 - |p|)/(-|p| + 1)
        //                   p/|p|
        // it sends -p/|p| to (-p/|p| - p)/(-p.complement()*-p/|p| + 1)
        //                    (-p/|p| - p)/(p.complement()*p/|p| + 1)
        //                    (-p/|p| - p)/(|p|^2/|p| + 1)
        //                    (-p/|p| - p)/(|p| + 1)
        //                    -p/|p|(1 + |p|)/(|p| + 1)
        //                    -p/|p|
        return new Xform(new Complex(1), p.neg(), p.complement().neg(), new Complex(1));
    }
    static readonly identity: Xform = new Xform(Complex.one, Complex.zero, Complex.zero, Complex.one);
}
