import Complex from './complex';

/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disk model.
 *
 * TODO: enable different K
 * TODO: zoom
 * TODO: Model/view separation
 * TODO: filled regions? paths?
 */
export default class HypCanvas {
    size: number;
    canvas?: HTMLCanvasElement;
    drawingElements: object[];
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
        this.drawingElements = [];
        this.canvas = undefined;
        this.pendingRedraw = false;
    }
    postRedraw() {
        if (!this.pendingRedraw) {
            requestAnimationFrame(() => this.draw());
            this.pendingRedraw = true;
        }
    }
    clear() {}
    make_canvas(): HTMLCanvasElement {
        if (!this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = this.size;
            this.canvas.height = this.size;
        }
        this.postRedraw();
        return this.canvas;
    }
    newTurtle(): Turtle {
        const hc = this;
        return new class {
            penIsDown: boolean;
            diskCoord: Complex;
            diskAngleUnit: Complex; // maybe this should be a unit complex?
            get canvas() {
                return hc;
            }
            constructor() {
                this.penIsDown = false;
                this.diskCoord = new Complex(0,0);
                this.diskAngleUnit = new Complex(1, 0);
            }
            pendown() {
                this.penIsDown = true;
            }
            penup() {
                this.penIsDown = false;
            }
            left(degrees: number) {
                leftRadians(degrees * (Math.PI / 180.0));
            }
            right(degrees: number) {
                this.left(-degrees);
            }
            leftRadians(radians: number) {
                let newAngleUnit = this.diskAngleUnit * new Complex(Math.cos(radians), Math.sin(radians));
                this.diskAngleUnit = newAngleUnit;
            }
            rightRadians(radians: number) {
                this.leftRadians(-radians);
            }
            backward(dist: number) {
                this.forward(-dist);
            }
            forward(dist: number) {
                const xf = Xform.pointToOrigin(this.diskCoord);
                // x1 transforms turtle location to origin
                const hypScale = new Complex(Math.tanh(0.5 * dist));
                const dest = this.diskAngleUnit.mul(hypScale);
                const destDisk = xf.invert().xform(dest, this.diskAngleUnit);
                if (this.penIsDown) {
                    this.canvas().drawingElements.push({ type: "line", from: this.diskCoord, to: destDisk });
                    this.postRedraw();
                }
                this.diskCoord = destDisk;
                this.diskAngleUnit = 
            }
        }();
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

        // render the disk boundary
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
    }
    // takes a hyperbolic point with coordinate x and xforms it into a complex disk coordinate.
    static polar(r: number, radians: number) -> Complex {
        // if a point is at a distance r from the disk origin, then the distance d on the 
        // hyperbolic plane is d = 2 * arctanh(r)
        // d/2 = arctanh(r)
        // tanh(d/2) = r
        const diskR = Math.tanh(0.5 * r);
        return new Complex(diskR * Math.cos(radians), diskR * Math.sin(radians));
    }
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
    xform(diskPoint: Complex): Complex {
        return (diskPoint.mul(this.a).add(this.b)).div(diskPoint.mul(this.c).add(this.d));
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
        h2.invert().compose(h1); // sends (z1, z2, z3) to (0,1,∞), then to (w1, w2, w3)
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
}




export interface Turtle {
    readonly canvas: HypCanvas;
    pendown(): void;
    penup(): void;
    left(degrees: number);
    forward(dist: number);
    backward(dist: number);
    /*
    // TODO: goto(point: Point);
    home();
    color();
    */
}
