import Complex from "./Complex";
import Xform from "./Xform";

/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disc model.
 *
 * TODO: enable different K
 * TODO: zoom
 * TODO: Model/view separation
 * TODO: filled regions? paths?
 */
export default class HypCanvas {
    private size: number;
    private canvas?: HTMLCanvasElement;
    private lines: {from: Complex, to: Complex}[];
    private pendingRedraw: boolean;
    private view: Xform;
    private touch?: { id: number, clientX: number, clientY: number };
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        this.size = opts?.size || 500;
        this.lines = [];
        this.canvas = undefined;
        this.pendingRedraw = false;
        this.view = Xform.identity;
        this.touch = undefined;
        Object.seal(this);
    }
    private postRedraw() {
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
            const c = document.createElement("canvas");
            this.canvas = c;
            c.width = this.size;
            c.height = this.size;
            c.onmousedown = m => this.input('mousedown', m);
            c.onmouseup = m => this.input('mouseup', m);
            c.onmousemove = m => this.input('mousemove', m);
                //c.ontouchcancel = m => this.input('touchcancel', m);
            c.ontouchend = m => this.input('touchend', m);
            c.ontouchmove = m => this.input('touchmove', m);
            c.ontouchstart = m => this.input('touchstart', m);
        }
        this.postRedraw();
        return this.canvas;
    }
    private input(handler: string, ev: any): any {
        if (handler === 'mousemove') {
            if (ev.buttons == 0) {
                // no buttons are down, so don't do anything.
                return;
            } 
            const screenEnd = { x: ev.clientX, y: ev.clientY };
            const screenStart = { x: screenEnd.x - ev.movementX, y: screenEnd.y - ev.movementY };

            this.doScreenMove(screenStart, screenEnd);
        } else if (handler === 'touchstart') {
            ev.preventDefault();
            if (this.touch) {
                // we already have a touch, thank you very much.
                return;
            }
            let t = ev.changedTouches.item(0);
            this.touch = { id: t.identifier, clientX: t.clientX, clientY: t.clientY };
        } else if (handler === 'touchend') {
            ev.preventDerfault();
            if (!this.touch) {
                // we don't have a touch, so we don't care
                return;
            }
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const t = ev.changedTouches.item(i);
                if (t.identifier === this.touch.id) {
                    this.touch = undefined;
                    return; // we're done here.
                }
            }
        } else if (handler === 'touchmove') {
            ev.preventDefault();
            if (!this.touch) {
                // we don't have a touch, so we don't care
                return;
            }
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const t = ev.changedTouches.item(i);
                if (t.identifier === this.touch.id) {
                    this.doScreenMove({ x: this.touch.clientX, y: this.touch.clientY },
                                      { x: t.clientX, y: t.clientY });
                    this.touch.clientX = t.clientX;
                    this.touch.clientY = t.clientY;
                }
            }
        } else {
            //console.log("got unhandled event on %s", handler, ev);
        }
    }
    private doScreenMove(screenStart: { x: number, y: number}, screenEnd: { x: number, y: number}) {
        let discStart = this.xyToComplex(screenStart);
        let discEnd = this.xyToComplex(screenEnd);

        //console.log("discStart ", discStart, " discEnd ", discEnd);
        if (discStart.magSq() > 1) { 
            // clamp it to disc
            discStart = discStart.scale(0.999/discStart.mag());
        }
        if (discEnd.magSq() > 1) { 
            // clamp it to disc
            discEnd = discEnd.scale(0.999/discEnd.mag());
        }
        let oToEnd, startToO, viewChange;
        try {
            oToEnd = Xform.originToPoint(discEnd);
            startToO = Xform.pointToOrigin(discStart);
            viewChange = oToEnd.compose(startToO);
        } catch (err) {
            console.error('got singular transform building view change');
            console.log('oToEnd ', oToEnd);
            console.log('startToO ', startToO);
            console.log('viewChange ', viewChange);
            throw err;
        }

        let newView;

        try {
            newView = viewChange.compose(this.view);
        } catch (err) {
            console.error('Got singular transform while prepending view change');
            console.log('view: ', this.view);
            console.log('viewChange: ', viewChange);
            throw err;
        }
        this.view = newView;
        //console.log("new view", this.view);
        this.postRedraw();
    }
    private draw() {
        //console.log("redrawing, with %d lines", this.lines.length);
        const canvas = this.canvas;
        //console.log(canvas);
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
        //console.log("HypCanvas.draw(): ", this.lines);
        for (const e of this.lines) {
            //console.log("drawing line ", e);
            this.drawDiscArcLine(context, this.view.xform(e.from), this.view.xform(e.to));
            //this.drawSimpleDiscLine(context, e.from, e.to);
        }
        this.pendingRedraw = false;
    }
    private complexToXY(c: Complex): { x: number, y: number } {
        const x = (1 + c.a)*this.size/2;
        const y = (1 - c.b)*this.size/2;
        return { x, y };
    }
    private xyToComplex(p: { x: number, y: number }): Complex {
        const a = p.x * 2 / this.size - 1;
        const b = 1 - p.y * 2 / this.size;
        return new Complex(a,b);
    }
    private drawSimpleDiscLine(context: CanvasRenderingContext2D, a: Complex, b: Complex) {
        context.beginPath();
        const ascreen = this.complexToXY(a);
        context.moveTo(ascreen.x, ascreen.y);
        const bscreen = this.complexToXY(b);
        context.lineTo(bscreen.x, bscreen.y);
        context.closePath();
        context.stroke();
    }
    private drawShortDiscArc(context: CanvasRenderingContext2D, center: Complex, p1: Complex, p2: Complex) {
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
        //console.log("start: ", start);
        //console.log("end: ", end);

        const startangle = Math.atan2(start.b, start.a);
        const endangle = Math.atan2(end.b, end.a);
        //console.log("startangle: ", startangle, " endangle: ", endangle);

        // so far, all these calculations have bene in sane complex right-handed coordinates (+y is up)
        // Now we go into the realm of raster coordinates and clockwise angles.
        // +y goes down.  Angles are measuered *clockwise* from the right.
        const centerScreen = this.complexToXY(center);
        const r = start.mag();
        const screen_r = r * this.size/2;

        context.beginPath();
        // the 'true' on the end is the 'counterclockwise' parameter
        context.arc(centerScreen.x, centerScreen.y, screen_r, -startangle, -endangle, true);
        //context.closePath();
        context.stroke();
    }
    private drawDiscArcLine(context: CanvasRenderingContext2D, a?: Complex, b?: Complex) {
        if (!a || !b) {
            throw 'bad drawLine';
        }
        const amagsq = a.magSq();
        if (amagsq < 0.0001 || b.magSq() < 0.0001) { 
            // a point is at the origin, so it's just a straight line.
            this.drawSimpleDiscLine(context, a, b);
            return;
        }
        // the circuler inversion of a
        // by some mystical mathematical mystery, this point (and the inversion of b)
        // are both on the orthoganlly intersecting circle that passes through a and b.
        const c = a.scale(1 / amagsq);
        // c.mag() === 1/a.mag()

        // checking if a, b, and c are collinear.  This will happen if a and b are on the
        // same radius or opposite radii.

        // vector from a to b 
        const ab = b.sub(a);
        // vector from a to c
        const ac = c.sub(a);
        // twice the area of the triangle abc
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
        const res = new Complex(discR * Math.cos(radians), discR * Math.sin(radians));
        //console.log(`polar(${r}, ${radians}) returns `, res);
        return res;
    }
    addLine(p1: Complex, p2: Complex) {
        this.lines.push({ from: p1, to: p2});
        this.postRedraw();
    }
    turtle(): Turtle {
        return new TurtleImpl(this);
    }
}

export { HypCanvas };

export interface Turtle {
    readonly canvas: HypCanvas;
    readonly penIsDown: boolean;
    clone(): Turtle;
    rotate(radians: number): void;
    forward(distance: number): void;
    penUp(): void;
    penDown(): void;
}

class TurtleImpl {
    readonly canvas: HypCanvas;
    penIsDown: boolean;
    // sends the origin and the +x vector to the turtle location and forward vector.
    private xform: Xform;
    constructor(canvas: HypCanvas) {
        this.canvas = canvas;;
        this.xform = Xform.identity;
        this.penIsDown = false;
        Object.seal(this);
    }
    clone(): Turtle {
        let t = new TurtleImpl(this.canvas);
        t.xform = this.xform;
        t.penIsDown = this.penIsDown;
        return t;
    }
    rotate(radians: number): void {
        this.xform = this.xform.compose(Xform.rotate(radians));
    }
    forward(distance: number): void {
        // start point of line
        const start = this.xform.xform(Complex.zero);
        // origin-local end point of line.
        const rawEnd = HypCanvas.polar(distance, 0);
        const fwd = Xform.originToPoint(rawEnd);
        const newXform = this.xform.compose(fwd);
        if (this.penIsDown) {
            // end point of line
            const end = newXform.xform(Complex.zero);
            this.canvas.addLine(start, end);
        }
        this.xform = newXform;
    }
    penDown() {
        this.penIsDown = true;
    }
    penUp() {
        this.penIsDown = false;
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
    const c2 = c1.div(b1);
    // translate left 0.5
    const c3 = new Complex(c2.a - 0.5, c2.b);

    // now a and b are at (-0.5, 0) and (+0.5, 0), and the third point is anywhere.
    // Center.x = 0.  We only need to find center.y.
    // it fulfills the following quadratic equation
    // [distance^2 between a and center} = {distance^2 between c and center}
    // 0.5^2 + y^2 = c3.a^2 + (y - c3.b)^2
    // 1/4 + y^2 = c3.a^2 + y^2 - 2*y*c3.b + c3.b^2
    // 1/4 = c3.a^2 + c3.b^2 - 2*y*c3.b
    // 1/4 - c3.magSq() = -2*y*c3.b
    // (c3.magSq() - 1/4)/(2*c3.b) = y

    // we know c3.b != 0 because the points are not collinear
    const y = (c3.magSq() - 0.25)/(2*c3.b);

    if (false) { // check intermediate answer
        let adistsq = 0.5*0.5 + y*y;
        let cdistsq = c3.a*c3.a + (y - c3.b)*(y - c3.b);
        if (Math.abs(adistsq - cdistsq) > 0.01) {
            throw `y was bad: adistsq=${adistsq}, cdistsq=${cdistsq}`
        }
    }


    // now reverse the transformations
    // translate right 0.5
    const center2 = new Complex(0.5, y);
    // rotate and scale (1,0) to b1
    const center1 = center2.mul(b1);
    // translate origin to a
    const center = center1.add(a);
    if (false) { // check final answer
        // check radii
        let ra = center.sub(a).mag();
        let rb = center.sub(b).mag();
        let rc = center.sub(c).mag();
        if (Math.abs(ra - rb) > 0.01 ||
            Math.abs(rb - rc) > 0.01) {
            throw `Got bad center: a=${a} b=${b} c=${c} center=${center}`;
        }
    }
    return center;
}

