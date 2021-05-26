import Complex from "./Complex";

// implements a Möbius transform, specifically for managing isometries within an open unit disk with the
// Poincare disc projection.
//
// This implementation is in denial about the point at infinity.  Hopefully this won't matter.
// zeroOneInf() uses it conceptually, but as far as I can tell I'll never need to actually use the
// point at infinity and incur the cost of the extra bookkeeping that entails.
// 
// According to wikipedia (
//     The subgroup of all Möbius transformations that map the open disk D = z : |z| < 1 to 
//     itself consists of all transformations of the form
//       f(z) = e^(iϕ)(z + b)(b.compement()*z + 1)
//
// So it looks like I'll only need to deal with a b where |b|<1 and a theta.  All compositions and
// rotations I use here ought to stay within this model.
//
// Instead of an angle theta, I'm going to use a unit complex t = e^(i*theta).  That'll be fine.

export default class Xform {
    // represents a Möbius transform over complex numbers of the form f(z) = (a*z + b)/(c*z + d)
    // with the condition ad - bc != 0.

    // This sort of thing also needs the domaain to be augmented by a "point at infinity", which
    // follows the rules that ∞ == x / 0 (given x != 0), and x / ∞ == 0.
    readonly b: Complex;
    readonly t: Complex;

    xform(z: Complex): Complex {
        // f(z) = e^(iϕ)(z + b)(b.compement()*z + 1)
        const den = this.b.complement().mul(z).add(Complex.one);
        const num = this.b.add(z);
        return num.div(den).mul(this.t);
    }
    private constructor(b: Complex, t: Complex) {
        this.b = b;
        this.t = t;
        Object.freeze(this);
    }

    // returns xform q such that q.compose(this) == this.compose(q) == identity
    invert(): Xform {
        // this sends 0 to t*b
        //           -b to 0
        // So we want a xform that sends
        //        1  t*b to 0
        //        2  0 to -b
        // 
        // from 1:
        // t*b + new_b == 0
        // new_b == -t*b
        //
        // from 2:
        // new_t*(z + new_b)/(new_b_*z + 1) == -b
        // new_t*new_b == -b
        // new_t*(-t*b) == -b
        // new_t = 1/t == t_
        return new Xform(this.b.mul(this.t).neg(), this.t.complement());
    }
    // x.inverseXform(p) is a.invert().xform(p) but faster
    inverseXform(p: Complex): Complex {
        // work backwards in two stages.
        // p == t*q and q == (r + b)(b_r + 1)
        // p == t*q
        // q == p/t = p*t_
        const q = p.mul(this.t.complement());
        // q == (r + b)(b_*r + 1)
        // I think r == (q - b)/(1 - q*b_) will work.
        // q == ((q - b)/(1 - q*b_) + b)/(b_*(q - b)/(1 - q*b_) + 1)
        // multiply num and denom by (1 - q*b_)
        //   == (q - b + b(1 - q*b_))/(b_*(q - b) + (1 - q*b_))
        //   == (q - b + b - qbb_)/(b_q - bb_ + 1 - qb_)
        //  == (1 - qbb_)/(1 - bb_)
        //  == q
        // r = (q - b)/(1 - q*b_) works.
        const r = q.sub(this.b).div(Complex.one.sub(q.mul(this.b.complement())));
        return r;
    }
    // composes this with other xform.
    //
    // let res = this.compose(other), then
    // res.xform(p) == this.xform(other.xform(p))
    compose(other: Xform): Xform {
        // the composed xform sends 0 to p.
        const p = this.xform(other.xform(Complex.zero));
        // so res_t*res_b == p
        // the composed xform sends q to 1
        const q = other.inverseXform(this.inverseXform(Complex.one));
        // so [1]  res_t*(q + res_b) == (res_b_*q + 1)
        // also, |q| == 1 so 1/q == q_
        // [2] res_b = p/res_t = p* res_t_
        // [3] res_b_ = p_ * res_t
        // we can substitute [2] and[3] into [1] now.
        // res_t*(q + p*res_t_) == (p_*res_t*q + 1)
        // res_t*q + p*res_t*res_t_ == p_*res_t*q + 1
        // res_t*q + p == p_*res_t*q + 1
        // res_t(q - p_*q) == 1 - p
        // [4] res_t == q_*(1 - p)/(1 - p_)
        // |p| < 1 and |1 - p| == |1 - p_| and |q| == 1 so |res_t| == 1.
        // let r = (1 - p)/|1 - p|, so |r| == 1
        // r_ = (1 - p_)/|1 - p|
        // r/r_ = (1 - p)/(1 - p_)
        // r*r_ = |r|^2 = 1, so 1/r_ == r
        // [5] (1 - p)/(1 - p)) = r/r_ = r*r
        // so, from [4] and 5
        // res_t = q_*r*r
        const r = Complex.one.sub(p).normalize();
        // Mathematically speaking, this second normalize is redundant.
        // Numerically speaking, it's necessary.
        const res_t = q.complement().mul(r).mul(r).normalize();
        const res_b = p.mul(res_t.complement());
        return new Xform(res_b, res_t);
    }

    // sends a point p to the origin, sends the origin to -p,
    // and keeps the ideal points in line with p immobile
    static pointToOrigin(p: Complex): Xform {
        return Xform.originToPoint(p.neg());
    }
    static originToPoint(p: Complex): Xform {
        return new Xform(p, Complex.one);
    }
    // Creates a Xform that rotates counterclockwise about the origin by the given radians
    static rotate(theta: number): Xform {
        let r = Complex.unit(theta);
        return new Xform(Complex.zero, r);
    }
    static readonly identity: Xform = new Xform(Complex.zero, Complex.one);
}

/*
interface XformableTo<X> {
    xformed(xf: Xform): X;
}
*/
