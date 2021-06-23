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

export default class MobXform {
    // represents a Möbius transform over complex numbers of the form f(z) = (a*z + b)/(c*z + d)
    // with the condition ad - bc != 0.

    // This sort of thing also needs the domaain to be augmented by a "point at infinity", which
    // follows the rules that ∞ == x / 0 (given x != 0), and x / ∞ == 0.
    readonly b: Complex;
    readonly t: Complex;

    /// TIER 0.  Only external dependencies, mostly Complex and math.
    static readonly identity: MobXform = new MobXform(Complex.zero, Complex.one);
    private constructor(b: Complex, t: Complex) {
        this.b = b;
        // it's up to caller to ensure t is normal.
        // constructor is private.  So only have to ensure this file does it right.
        this.t = t; 
        Object.freeze(this);
    }
    xform(z: Complex): Complex {
        // f(z) = e^(iϕ)(z + b)(b.compement()*z + 1)
        const den = z.mulComp(this.b).add(Complex.one);
        const num = this.b.add(z);
        return num.div(den).mul(this.t);
    }

    // returns xform q such that q.compose(this) == this.compose(q) == identity
    invert(): MobXform {
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
        return new MobXform(this.b.mul(this.t).neg(), this.t.complement());
    }
    // a.inverseMobXform(p) is a.invert().xform(p) but faster
    inverseXform(p: Complex): Complex {
        // work backwards in two stages.
        // p == t*q and q == (r + b)(b_r + 1)
        // p == t*q
        // q == p/t = p*t_
        const q = p.mulComp(this.t);
        // q == (r + b)(b_*r + 1)
        // I think r == (q - b)/(1 - q*b_) will work.
        // q == ((q - b)/(1 - q*b_) + b)/(b_*(q - b)/(1 - q*b_) + 1)
        // multiply num and denom by (1 - q*b_)
        //   == (q - b + b(1 - q*b_))/(b_*(q - b) + (1 - q*b_))
        //   == (q - b + b - qbb_)/(b_q - bb_ + 1 - qb_)
        //  == q(1 - bb_)/(1 - bb_)
        //  == q
        // r = (q - b)/(1 - q*b_) works.
        const r = q.sub(this.b).div(Complex.one.sub(q.mulComp(this.b)));
        return r;
    }
    // given p with |p|<1 and ideal point q with |q| = 1, 
    // returns MobXform that sends 0 to p and 1 to q.
    static fromZeroOne(p: Complex, q: Complex): MobXform {
        // in the following equations, t and b are the parameters of the new Xform
        // which we are looking for.
        // the composed xform sends 0 to p.
        // t*b = p
        // since |t| = 1, |b| = |p| and bb_ = pp_
        // the composed xform sends 1 to q
        // t*(1 + b)/(b_ + 1) = q
        // p/q = b(b_ + 1)/(1 + b)
        //     = (bb_ + b)(1 + b)
        // p/q = (pp_ + b)/(1 + b)
        // |q| = 1, so 1/q = q_
        // pq_ = (pp_- 1 + 1 + b)/(1 + b)
        // pq_ = (pp_ - 1)/(1 + b) + 1
        // (pq_ - 1) = (pp_ - 1)/(1 + b)
        // (1 + b) = (pp_ - 1)/(pq_ - 1)
        // b = (pp_ - 1 - pq_ + 1)/(pq_ - 1)
        // b = (pp_ - pq_)/(pq_ - 1)
        // b = p(q_ - p_)/(1 - pq_)
        // t*b = p
        // t = p/b;
        // t = (1 - pq_)/(q_ - p_)
        // since qq_ = 1, multiply by q/q
        // t = (q - p)/(1 - p_q)
        const t = q.sub(p).div(Complex.one.sub(q.mulComp(p))).normalize();
        // b = p/t = p*t_
        const b = p.mulComp(t);
        return new MobXform(b, t);
    }
    // returns a transform that sends x to 0 and ideal y to 1.
    static toZeroOne(x: Complex, y: Complex): MobXform {
        // 0 = t(x + b)/(b_x + 1)
        /// we know |t| = 1 |b|<1 and |x|<1, so |b_x + 1| > 0 
        // so we just need to satisfy x + b = 0
        const b = x.scale(-1);
        // now need to find t.
        // 1 = t(y + b)/(yb_ + 1)
        // t = (yb_ + 1)/(y + b)
        const t = y.mulComp(b).add(Complex.one).div(y.add(b)).normalize();
        return new MobXform(b, t);
    }
    static originToPoint(p: Complex): MobXform {
        return new MobXform(p, Complex.one);
    }
    // Creates a MobXform that rotates counterclockwise about the origin by the given radians
    static rotate(theta: number): MobXform {
        const r = Complex.unit(theta);
        return new MobXform(Complex.zero, r);
    }

    // TIER 1.  These functions depend on Tier 0.

    // composes this with other xform.
    //
    // let res = this.compose(other), then for all p
    // res.xform(p) == this.xform(other.xform(p))
    compose(other: MobXform): MobXform {
        const p = this.xform(other.xform(Complex.zero));
        const q = this.xform(other.xform(Complex.one))
        return MobXform.fromZeroOne(p, q);
    }
    static composeMany(xfs: MobXform[]): MobXform {
        let p = Complex.zero;
        let q = Complex.one;
        for (let i = xfs.length - 1; i >= 0; i--) {
            const xf = xfs[i];
            p = xf.xform(p);
            q = xf.xform(q);
        }
        return MobXform.fromZeroOne(p, q);
    }

    // sends a point p to the origin, sends the origin to -p,
    // and keeps the ideal points in line with p immobile
    static pointToOrigin(p: Complex): MobXform {
        return MobXform.originToPoint(p.neg());
    }

    // Tier 2, depending on Tiers 1 and 0.

    // returns a transform that sends point x1 to x2, and ideal y1 to ideal y2.
    static twoPoint(x1: Complex, y1: Complex, x2: Complex, y2: Complex): MobXform {
        // t1[x1, y1] = [0, 1]
        const t1 = MobXform.toZeroOne(x1, y1);
        // t2[0, 1] = [x2, y2]
        const t2 = MobXform.fromZeroOne(x2, y2);
        // (t2.t1) [x1, y1] = [x2, y2]
        const tRes = t2.compose(t1);
        return tRes;
    }
}

