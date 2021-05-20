import Complex from './complex';

/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disc model.
 *
 * TODO: enable different K
 * TODO: zoom
 * TODO: Model/view separation
 * TODO: filled regions? paths?
 */
export default class HypCanvas {
    size: number;
    canvas?: HTMLCanvasElement;
    lines: {from: Complex, to: Complex}[];
    pendingRedraw: boolean;
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        if (opts && opts.size) {
            this.size = opts.size;
        } else {
            this.size = 500;
        }
        this.lines = [];
        this.canvas = undefined;
        this.pendingRedraw = false;
    }
    postRedraw() {
        if (!this.pendingRedraw) {
            requestAnimationFrame(() => this.draw());
            this.pendingRedraw = true;
        }
    }
    clear() {
        this.lines = []
        this.postRedraw();
    }
    makeCanvas(): HTMLCanvasElement {
        if (!this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = this.size;
            this.canvas.height = this.size;
        }
        this.postRedraw();
        return this.canvas;
    }
    draw() {
        const canvas = this.canvas;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
            console.error("couldn't create canvas context"); 
            return 
        }
        context.clearRect(0, 0, canvas.width || 0, canvas.height || 0);

        // set the stroke style to black
        context.strokeStyle = "#000";

        // render the disc boundary
        context.beginPath();
        context.arc(
            this.size / 2,
            this.size / 2,
            this.size / 2,
            0,
            Math.PI * 2
        );
        context.closePath();
        context.stroke();
        for (const e of this.lines) {
            this.drawDiscArcLine(context, e.from, e.to);
        }
    }
    complexToXY(c: Complex): { x: number, y: number } {
        const x = (1 + c.a)*this.size/2;
        const y = (1 - c.b)*this.size/2;
        return { x, y };
    }
    drawSimpleDiscLine(context: CanvasRenderingContext2D, a: Complex, b: Complex) {
        context.beginPath();
        const ascreen = this.complexToXY(a);
        context.moveTo(ascreen.x, ascreen.y);
        const bscreen = this.complexToXY(b);
        context.moveTo(bscreen.x, bscreen.y);
        context.closePath();
        context.stroke();
    }
    drawShortDiscArc(context: CanvasRenderingContext2D, center: Complex, p1: Complex, p2: Complex) {
        const p1vec = p1.sub(center);
        const p2vec = p2.sub(center);


        // cross product of v1 x v2 is |v1|*|v2|*sin(angle from v1 to v2)
        // so its sign tells us the short arc direction
        const cross = p1vec.a*p2vec.b - p1vec.b*p2vec.a;
        // arc is going to go from start to end
        let start, end;
        if (cross > 0) {
            start = p1vec;
            end = p2vec;
        } else {
            start = p2vec;
            end = p1vec;
        }

        const startangle = Math.atan2(start.b, start.a);
        const endangle = Math.atan2(end.b, end.a);

        const centerScreen = this.complexToXY(center);
        const r = start.mag();
        const screen_r = r * this.size/2;
        context.beginPath();
        // the 'true' on the end is the 'counterclockwise' parameter
        context.arc(centerScreen.x, centerScreen.y, screen_r, startangle, endangle, true);
        context.closePath();
        context.stroke();
    }
    drawDiscArcLine(context: CanvasRenderingContext2D, a?: Complex, b?: Complex) {
        if (!a || !b) {
            throw 'bad drawLine';
        }
        const amag = a.magSq();
        if (a.magSq() < 0.0001) { 
            // a is the origin, so it's just a straight line.
            this.drawSimpleDiscLine(context, a, b);
            return;
        }
        // the circuler inversion of a
        const c = a.scale(1 / a.magSq());
        // need to find the circle covering a, b, and c
        // vector from a to b 
        const ab = b.sub(a);
        // vector from a to c
        const ac = c.sub(a);
        const twiceabc = ac.a*ab.b - ac.b*ab.a;
        if (Math.abs(twiceabc) < 0.0001) {
            // points are collinear, draw a straight line
            this.drawSimpleDiscLine(context, a, b);
            return;
        }
        let center = findCenter(a, b, c);
        this.drawShortDiscArc(context, center, a, b);
    }
    // takes a hyperbolic point in polar coordinates and xforms it into Poincare disc coordinate.
    static polar(r: number, radians: number): Complex {
        // if a point is at a distance r from the disc origin, then the distance d on the 
        // hyperbolic plane is d = 2 * arctanh(r)
        // d/2 = arctanh(r)
        // tanh(d/2) = r
        const discR = Math.tanh(0.5 * r);
        return new Complex(discR * Math.cos(radians), discR * Math.sin(radians));
    }
    addLine(p1: Complex, p2: Complex) {
        this.lines.push({ from: p1, to: p2});
    }
}

function det(a: number, b: number, c: number, d: number): number {
    return a*d - b*c;
}

// requires a,b,c are not collinear
function findCenter(a: Complex, b: Complex, c: Complex): Complex {
    // translate a to origin
    const b1 = b.sub(a);
    const c1 = c.sub(a);
    // rotate and scale b1 to (1,0);
    const c2 = c.div(b1);
    // translate left 0.5
    const c3 = new Complex(c2.a - 0.5, c2.b);

    // now a and b are at (-0.5, 0) and (+0.5, 0), and the third point is anywhere.
    // Center.x = 0.  We only need to find center.y.
    // it fulfills the following quadratic equation
    // (0.5^2 + y^2) = c3.a^2 + (y - c3.b)^2
    // 1/4 + y^2 = c3.a^2 + y^2 - 2*y*c3.b + c3.b^2
    // 1/4 = c3.a^2 + c3.b^2 - 2*y*c3.b
    // 1/4 - c3.magSq() = 2*y*c3.b
    // (1/4 - c3.magSq())/(2*c3.b) = y

    // we know c2.b !=0 because the points are not collinear
    const y = (0.25 - c3.magSq())/(2*c3.b);

    // now reverse the transformations
    // translate right 0.5
    const center2 = new Complex(0.5, y);
    // rotate and scale (1,0) to b1
    const center1 = center2.mul(b1);
    // translate origin to a
    const center = center1.add(a);
    return center;
}


export class Xform {
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
            this.d.mul(other.b).add(this.d.mul(other.d))
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




