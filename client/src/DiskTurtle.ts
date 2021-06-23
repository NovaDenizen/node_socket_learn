import MobXform from "./MobXform";
import Complex from "./Complex";
// TODO: HypCanvas seems mostly irrelevant, it should be broken up
import HypCanvas from "./HypCanvas";

// this is a Turtle class that makes it less horrible to do geometric things with 
// a Poincare Disk view of the hyperbolic plane.
// It's a very thin wrapper around a MobXform.
export default class DiskTurtle {
    // sends the origin and the +x vector to the turtle location and forward vector.
    xform: MobXform;
    constructor(arg?: MobXform | DiskTurtle) {
        if (!arg) {
            this.xform = MobXform.identity;
        } else if (arg instanceof DiskTurtle) {
            this.xform = arg.xform;
        } else if (arg instanceof MobXform) {
            this.xform = arg;
        } else {
            throw new Error("Invalid arg in DiskTurtle constructor");
        }
        Object.seal(this);
    }
    // send the turtle to the origin, pointing in +x direction.
    home(): void {
        this.xform = MobXform.identity;
    }
    // rotate the turtle counterclockwise
    rotate(radians: number): void {
        this.xform = this.xform.compose(MobXform.rotate(radians));
    }
    // moves turtle forward this distance in the metric.
    forward(distance: number): void {
        const offset = HypCanvas.polar(distance, 0);
        this.move(offset);
    }

    // Assuming turtle is at home position (at origin, pointing +X), move it to this offset on the disk.
    // So offset is the movement relative to the Turtle's reference frame.
    move(offset: Complex): void {
        const fwd = MobXform.originToPoint(offset);
        const newMobXform = this.xform.compose(fwd);
        this.xform = newMobXform;
    }
    // where in the projection is the turtle?
    position(): Complex {
        return this.xform.xform(Complex.zero);
    }
    // If you draw a ray out of the front of the turtle,
    // what ideal point would it hit?
    idealPosition(): Complex {
        return this.xform.xform(Complex.one);
    }
    // rfr stands for 'rotate, forward, rotate'.
    // Given another turtle, determine values such that
    // this.rotate(rot1); this.forward(forward); this.rotate(rot2);
    // will place this turtle identically to other.
    // TODO: this result type is equivalent ot HypCanvas.FrameTransition.  harmonize it.
    rfr(other: DiskTurtle): { rot1: number, forward: number, rot2: number } {
        // xforms are associative and inversions compose to the identity.
        // this.compose(difference) == other
        // this.invert().compose(this.compose(difference)) == this.invert().compose(other)
        // difference == this.inverse().compose(other);
        const diff = this.xform.invert().compose(other.xform);
        const dt = diff.t;
        const db = diff.b;
        // using haskell-style lambdas and functoin composition
        // diff = (*dt) . (t=1, b=db)
        // db is not likely to be both real and positive.
        // (t, b) = \z . t*(z + b)/(b_*z + 1)
        // (t=1, b=db) = \z . (z + db)/(db_*z + 1)
        // let q = db/|db|, |q| == 1, qq_ = 1
        // (*q_) . (t=1, b=db) . (*q) $ z = q_ * (qz + db)/(db_*qz + 1)
        //                                  = (z + q_*db)/(db_*qz + 1)
        //                                  = (t=1, b=q_db) $ z
        // (*q_) . (t=1, b=db) . (*q) = (t=1, b=q_db)
        // prepend both with (*q) and append both with (*q_)
        // (*q) . (*q_) . (t=1, b=db) . (*q) . (*q_) = (*q) . (t=1, b=q_db) . (*q_)
        // (*qq_) is identity
        // (t=1, b=db) = (*q) . (t=1, b=q_db) . (*q_)
        // q_db = db_ / |db| * db = |db|^2 / |db| = |db|
        // diff = (t=dt, b=0) . (t=1, b=db)
        //      = (t=dt, b=0) . (*q) . (t=1, b=q_db) . (*q_)
        //      = (t=dt*q, b=0) . (t=1,b=q_db) . (t=q_, b=0)
        //      = [rotate by dt*q] . [forward |db|] . [rotate by q_]
        if (db.magSq() < 0.000001) {
            // no movement, just a rotation.
            return { rot1: Math.atan2(dt.b, dt.a), forward: 0, rot2: 0 };
        }
        const q = db.normalize();
        const t1 = dt.mul(q);
        const rot1 = Math.atan2(t1.b, t1.a);
        const forward = db.mag();
        const rot2 = Math.atan2(-q.b, q.a);
        return { rot1, forward, rot2 };
    }
    // given a point p on the projection, where does it appear to be relative to the turtle?
    // in other words, 
    // let q = this.relativePosition(p);
    // this.move(q);
    // now this.position() is p
    relativePosition(p: Complex): Complex {
        return this.xform.inverseXform(p);
    }
    // Aim the turtle at a given point on the disk.
    aimAt(p: Complex): void {
        const rp = this.relativePosition(p);
        if (rp.magSq() < 0.000000001) {
            throw new Error("point is too nearby to aim at");
        }
        const bearing = Math.atan2(rp.b, rp.a);
        this.rotate(bearing);
    }
}
