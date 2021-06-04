import Complex from "./Complex";
import Xform from "./Xform";

// bearing, offset, and orientation are the instructions a turtle needs to follow to get from the 
// home position of the current frame to the home position of the other frame.
// t.rotate(bearing); t.forward(offset); t.rotate(orientation);
// This is, of course, equivalent to either a t.move(...); t.rotate(..) or t.rotate(); t.move(..), 
// but in this slightly redundant representation the parameters are real-valued.
export type FrameTransition = { bearing: number, offset: number, orientation: number };
export type Anchor = { id: string, 
                neighbors: { id: string, transition: FrameTransition }[], 
                draw: (t: Turtle) => void
              };
export type WorldMap = Map<string, Anchor>;

export type Drawer = {
    drawLine(x: Complex, y: Complex, strokeStyle?: string): void;
    drawPoly(ps: Complex[], style?: { fillStyle?: string, strokeStyle?: string }): void;
}

/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disk model.
 *
 * TODO: zoom
 * TODO: Model/view separation
 */

/*

This is not adequate.
There sure are a lot of remember-and-replay stages involved here.

We need a record of all drawing instructions stored in a view-independent manner,
so that when the view changes we can rerun them to draw the current display in the
new view xform.

We need a DiskRenderingContext that consumes straight-line operations like a
CanvasRenderingContext2D, applies a view xform, turns the line into a screen-coordinate arc,
and calls CanvasRenderingContext2D.arcTo().

*/
class DiskRenderingContext {
    private hypCanvas: HypCanvas;
    private firstPathPoint: Complex;
    private lastPathPoint: Complex;
    private xOffset: number;
    private yOffset: number;
    private scale: number;
    private ctx2d: CanvasRenderingContext2D;
    private view: Xform;
    constructor(hypCanvas: HypCanvas, htmlCanvas: HTMLCanvasElement, view: Xform) {
        this.hypCanvas = hypCanvas;
        const width = htmlCanvas.width || 500;
        const height = htmlCanvas.height || 500;
        this.yOffset = height/2;
        this.xOffset = width/2;
        this.view = view;
        this.scale = Math.min(this.xOffset, this.yOffset);
        this.firstPathPoint = this.viewed(Complex.zero);
        this.lastPathPoint = this.firstPathPoint;
        const ctx = htmlCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("couldn't create CanvasRenderingContext2D");
        }
        this.ctx2d = ctx;
    }
    clear() {
        const c = this.ctx();
        // clears the canvas to the background color
        c.clearRect(0, 0, this.xOffset*2, this.yOffset*2);
        // set the styles to solid black
        c.strokeStyle = "#000";
        c.fillStyle = "#888";
        // set the path to the border of the disk
        c.beginPath();
        c.arc(this.xOffset, this.yOffset, this.scale, 0, Math.PI*2);
        c.closePath();
        // draw the outline
        c.stroke();
        // fill the interior
        c.fill();
        c.fillStyle = "#000"; // resetting it.
    }

    private viewed(p: Complex): Complex {
        return this.view.xform(p);
    }
    ctx(): CanvasRenderingContext2D {
        if (!this.ctx2d) {
            throw new Error("couldn't create canvas context");
        }
        return this.ctx2d;
    }
    toScreen(p: Complex): { x: number, y: number } {
        const x = p.a * this.scale + this.xOffset;
        const y = -p.b * this.scale + this.yOffset;
        return { x, y };
    }
    moveTo(p: Complex) {
        const xp = this.viewed(p);
        const sp = this.toScreen(xp);
        this.ctx().moveTo(sp.x, sp.y);
        this.lastPathPoint = xp;
    }
    lineTo(p: Complex) {
        const a = this.lastPathPoint;
        const b = this.viewed(p);
        this.lastPathPoint = b;

        // looking for center c (and possibly r, radius of circle at c).
        // |c - a| = |c - b| = r
        // the right triangle formed by the centers and an intersection point
        // satisfies |c|^2 = 1 + r^2
        // (c - a)(c_ - a_) = r^2
        // (c - b)(c_ - b_) = r^2
        // cc_ = 1 + r^2
        // cc_ - cb_ - bc_ + bb_ = r^2
        // 1 + bb_ - (bc_ + cb_) = 0
        // 1 + bb_ = bc_ + cb_
        // sidebar:   (bc_ + cb_) looks simplifiable
        //        let b = w + xi
        //        let c = y + zi
        //        (w + xi)(y - zi) + (y + zi)(w - xi)
        //        (wy - wzi + xyi + xz) + (wy - xyi + wzi + xz)
        //        (2wy + 2xz)
        //        It's like a double dot product. 2*|b||c|cos(angle)
        // 2*(b.a*c.a + b.b*c.b) = 1 + bb_
        // 2*(a.a*c.a + a.b*c.b) = 1 + aa_
        // b.a*c.a + b.b*c.b = (1 + bb_)/2 = g
        // a.a*c.a + a.b*c.b = (1 + aa_)/2 = h
        // det = (b.a*a.b) - (a.a*b.b)
        // if a and b and origin are collinear (or either a or b are the origin), then det = 0.
        // c.a = (g*a.b - b.b*h)/det
        // c.b = (b.a*h - a.a*g)/det
        const det = (b.a*a.b) - (a.a*b.b);
        if (a.magSq() > 0.9999 && b.magSq() > 0.9999) {
            // two ideal points, need to follow the outer edge counterclockwise
            this.drawIdealArc(a, b);
        } else if (Math.abs(det) < 0.00001) {
            this.drawScreenLine(a, b);
        } else {
            const g = (1 + b.magSq())/2;
            const h = (1 + a.magSq())/2;
            const center = new Complex((g*a.b - b.b*h)/det, (b.a*h - a.a*g)/det);
            this.drawScreenArc(center, a, b);
        }
    }
    beginPath(): void {
        this.ctx().beginPath();
        this.firstPathPoint = this.lastPathPoint;
    }
    closePath(): void {
        const p = this.firstPathPoint;
        this.lineTo(p);
        this.ctx().closePath();
    }

    stroke() {
        this.ctx().stroke();
    }
    fill() {
        this.ctx().fill();
    }

    private drawScreenLine(a: Complex, b: Complex) {
        const sb = this.toScreen(b);
        this.ctx().lineTo(sb.x, sb.y);
    }
    private drawScreenArc(center: Complex, p1: Complex, p2: Complex) {
        const p1vec = p1.sub(center);
        const p2vec = p2.sub(center);

        const cross = p1vec.a*p2vec.b - p1vec.b*p2vec.a;
        const counterClockwise = cross > 0;
        const radius = p1vec.mag()*this.scale;

        const p1s: { x: number, y: number } = this.toScreen(p1);
        const p2s: { x: number, y: number } = this.toScreen(p2);
        const centers = this.toScreen(center);
        // these are the sane normal angles where 0 is +x and +angle goes CCW
        const saneStartAngle = Math.atan2(p1vec.b, p1vec.a);
        const saneEndAngle = Math.atan2(p2vec.b, p2vec.a);
        // these are the insane javascript raster angles where +angle goes clockwise
        const insaneStartAngle = -saneStartAngle;
        const insaneEndAngle = -saneEndAngle;

        this.ctx().arc(centers.x, centers.y, radius, insaneStartAngle, insaneEndAngle, counterClockwise);
    }
    private drawIdealArc(p1: Complex, p2: Complex) {
        const saneStartAngle = Math.atan2(p1.b, p1.a);
        const saneEndAngle = Math.atan2(p2.b, p2.a);
        const centers = this.toScreen(Complex.zero);
        const p1s = this.toScreen(p1);
        const p2s = this.toScreen(p2);
        const insaneStartAngle = -saneStartAngle;
        const insaneEndAngle = -saneEndAngle;
        this.ctx().arc(centers.x, centers.y, this.scale, insaneStartAngle, insaneEndAngle, true);
    }
}

interface RenderInst {
    exec(ctx: DiskRenderingContext): void;
}
class MoveTo implements RenderInst {
    p: Complex;
    constructor(p: Complex) {
        this.p = p;
    }
    exec(ctx: DiskRenderingContext): void {
        ctx.moveTo(this.p);
    }
}
class LineTo implements RenderInst {
    p: Complex;
    constructor(p: Complex) {
        this.p = p;
    }
    exec(ctx: DiskRenderingContext): void {
        ctx.lineTo(this.p);
    }
}
class BeginPath implements RenderInst {
    exec(ctx: DiskRenderingContext): void {
        ctx.beginPath();
    }
}
class ClosePath implements RenderInst {
    exec(ctx: DiskRenderingContext): void {
        ctx.closePath();
    }
}
class DoStroke implements RenderInst {
    exec(ctx: DiskRenderingContext): void {
        ctx.stroke();
    }
}
class DoFill implements RenderInst {
    exec(ctx: DiskRenderingContext): void {
        ctx.fill();
    }
}
class SetStroke implements RenderInst {
    style: string;
    constructor(style: string) {
        this.style = style;
    }
    exec(ctx: DiskRenderingContext): void {
        ctx.ctx().strokeStyle = this.style;
    }
}
class SetFill implements RenderInst {
    style: string;
    constructor(style: string) {
        this.style = style;
    }
    exec(ctx: DiskRenderingContext): void {
        ctx.ctx().fillStyle = this.style;
    }
}

export default class HypCanvas {
    private size: number;
    private canvas?: HTMLCanvasElement;
    private insts: RenderInst[];
    private drawFuncs: ((d: Drawer) => void)[];

    private pendingRedraw: boolean;
    private view: Xform;
    private touch?: { id: number, x: number, y: number };
    logger: (msg: string) => void;
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        this.size = opts?.size || 500;
        this.insts = [];;
        this.canvas = undefined;
        this.pendingRedraw = false;
        this.view = Xform.identity;
        this.touch = undefined;
        this.logger = (msg) => { /* nothing */ };
        this.drawFuncs = [];
        Object.seal(this);
    }
    private postRedraw() {
        if (!this.pendingRedraw) {
            requestAnimationFrame(() => this.draw());
            this.pendingRedraw = true;
        }
    }
    clear() {
        this.insts = [];
        this.drawFuncs = [];
        this.postRedraw();
    }
    reset() {
        this.view = Xform.identity;
        this.clear();
    }
    makeCanvas(): HTMLCanvasElement {
        if (!this.canvas) {
            const c = document.createElement("canvas");
            this.canvas = c;
            c.width = this.size;
            c.height = this.size;
            c.onmousedown = m => this.mouse_input('mousedown', m);
            c.onmouseup = m => this.mouse_input('mouseup', m);
            c.onmousemove = m => this.mouse_input('mousemove', m);
            c.ontouchcancel = m => this.touch_input('touchcancel', m);
            c.ontouchend = m => this.touch_input('touchend', m);
            c.ontouchmove = m => this.touch_input('touchmove', m);
            c.ontouchstart = m => this.touch_input('touchstart', m);
        }
        this.postRedraw();
        return this.canvas;
    }
    private mouse_input(handler: string, ev: MouseEvent): any {
        if (handler === 'mousemove') {
            if (ev.buttons === 0) {
                // no buttons are down, so don't do anything.
                return;
            }
            const screenEnd = { x: ev.clientX, y: ev.clientY };
            const screenStart = { x: screenEnd.x - ev.movementX, y: screenEnd.y - ev.movementY };

            this.doScreenMove(screenStart, screenEnd);
        }
    }
    private touch_input(handler: string, ev: TouchEvent) {
        if (handler === 'touchstart') {
            if (this.touch) {
                // we already have a touch, thank you very much.
                return;
            }
            const t = ev.changedTouches.item(0);
            if (t) {
                this.touch = { id: t.identifier, x: t.clientX, y: t.clientY };
            } else {
                throw new Error("I can't index arrays");
            }
            ev.preventDefault();
        } else if ((handler === 'touchend') || (handler === 'touchcancel')) {
            ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
            if (this.touch === undefined) {
                // We don't have a touch, so we don't care.
                return;
            }
            // this.logger(`checking all ${ev.changedTouches.length} changed touches`);

            for (let i = 0; i < ev.changedTouches.length; i++) {
                const t = ev.changedTouches.item(i);
                // this.logger(`checking changedTouch[${i}] = ${JSON.stringify(t)}`);
                if (!t) {
                    throw new Error("ev.changedTouches isn't working");
                }
                if (t.identifier === this.touch.id) {
                    this.touch = undefined;
                    // this.logger(`touch is now ${JSON.stringify(this.touch)}`);
                    ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
                    return; // we're done here.
                }
            }
        } else if (handler === 'touchmove') {
            ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
            if (!this.touch) {
                // we don't have a touch, so we don't care
                ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
                return;
            }
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const t = ev.changedTouches.item(i);
                if (t) {
                    if (t.identifier === this.touch.id) {
                        this.doScreenMove({ x: this.touch.x, y: this.touch.y },
                                          { x: t.clientX, y: t.clientY });
                        this.touch.x = t.clientX;
                        this.touch.y = t.clientY;
                    }
                } else {
                    throw new Error("I can't index arrays");
                }
            }
        } else {
            // this.logger(`got unhandled event ${handler}`);
        }
    }
    private doScreenMove(screenStart: { x: number, y: number}, screenEnd: { x: number, y: number}) {
        let diskStart = this.xyToComplex(screenStart);
        let diskEnd = this.xyToComplex(screenEnd);

        // console.log("diskStart ", diskStart, " diskEnd ", diskEnd);
        const radiusLimit = 0.9;
        if (diskStart.mag() > radiusLimit) {
            // clamp it to disk
            diskStart = diskStart.normalize().scale(radiusLimit);
        }
        if (diskEnd.magSq() > radiusLimit) {
            // clamp it to disk
            diskEnd = diskEnd.normalize().scale(radiusLimit);
        }
        let oToEnd;
        let startToO;
        let viewChange;
        try {
            oToEnd = Xform.originToPoint(diskEnd);
            startToO = Xform.pointToOrigin(diskStart);
            viewChange = oToEnd.compose(startToO);
        } catch (err) {
            throw new Error('got singular transform building view change');
        }

        let newView;

        try {
            newView = viewChange.compose(this.view);
        } catch (err) {
            throw new Error("Got singular transform while prepending view change");
        }
        this.view = newView;
        // console.log("new view", this.view);
        this.postRedraw();
    }
    private draw() {
        // TODO: Change to WorldMap rendering schema.
        //     this.xform will be relative to the currnet main anchor.
        //     User scrolls around, this.xform gets updated.
        //     When another anchor gets closer to the center of the view, 
        //     that anchor takes over as the main anchor
        //     Traversal will stop when an anchor's transformed position is larger than some bound (0.95?)
        //
        // TODO: switch turtle back to immediate mode, use anonymous functions for drawing instructions.
        const canvas = this.canvas;
        // console.log(canvas);
        if (!canvas) {
            return;
        }
        const drc = new DiskRenderingContext(this, canvas, this.view);
        drc.clear();
        for (const i of this.insts) {
            i.exec(drc);
        }
        const view = this.view;
        const hc = this;
        const d: Drawer = {
            drawLine: (a: Complex, b: Complex, strokeStyle?: string) => {
                drc.beginPath();
                drc.moveTo(a);
                drc.lineTo(b);
                drc.ctx().strokeStyle = strokeStyle || "black";
                drc.stroke();
            },
            drawPoly: (ps: Complex[], style?: { fillStyle?: string, strokeStyle?: string }) => {
                if (ps.length == 0) {
                    return;
                }
                drc.beginPath();
                drc.moveTo(ps[0]);
                for (let i = 1; i < ps.length; i++) {
                    drc.lineTo(ps[i]);
                }
                drc.lineTo(ps[0]);
                if (style && style.fillStyle) {
                    drc.ctx().fillStyle = style.fillStyle;
                    drc.fill();
                }
                if (style && style.strokeStyle) {
                    drc.ctx().strokeStyle = style.strokeStyle;
                    drc.stroke();
                }
            },
        };
        Object.freeze(d);
        for (const f of this.drawFuncs) {
            f(d);
        };
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
    // takes a hyperbolic point in polar coordinates and xforms it into Poincare disk coordinate.
    // r is the distance from the origin in the poincare metric.
    static polar(r: number, radians: number): Complex {
        // if a point is at a distance r from the disk origin, then the distance d on the
        // hyperbolic plane is d = 2 * arctanh(r)
        // d/2 = arctanh(r)
        // tanh(d/2) = r
        const diskR = Math.tanh(0.5 * r);
        const res = Complex.unit(radians).scale(diskR);
        return res;
    }
    addLine(p1: Complex, p2: Complex): void {
        // this.logger(`addLine(${p1}, ${p2})`);
        this.insts.push(new BeginPath());
        this.insts.push(new MoveTo(p1));
        this.insts.push(new LineTo(p2));
        this.insts.push(new DoStroke())
        this.postRedraw();
    }
    addPolygonPath(ps: Complex[]): void {
        if (ps.length === 0) {
            return;
        }
        this.insts.push(new MoveTo(ps[0]));
        this.insts.push(new BeginPath());
        for (let i = 1; i < ps.length; i++) {
            this.insts.push(new LineTo(ps[i]));
        }
        this.insts.push(new LineTo(ps[0]));
    }
    pushInst(i: RenderInst): void {
        this.insts.push(i);
        this.postRedraw();
    }
    turtle(): Turtle {
        return new Turtle(this);
    }
    static metric(z1: Complex, z2: Complex): number {
        const termNumerator = z1.sub(z2);
        // if |z1| < 1 && |z2| < 1 then this is > 0
        const termDenominator = Complex.one.sub(z1.mul(z2.complement()));
        return 2*Math.atanh(termNumerator.mag() / termDenominator.mag());
    }
    static origin_metric(z: Complex): number {
        return 2*Math.atanh(z.mag());
    }
    setMap(wm: WorldMap, anchorId: string): void {
        // set the WorldMap, focused on anchorId.
    }
    addDrawFunc(f: (d: Drawer) => void): void {
        this.drawFuncs.push(f);
        this.postRedraw();
    }
}

export { HypCanvas };

export class Turtle {
    readonly canvas: HypCanvas;
    // when penIsDown, moves are added via HypCanvas.pushInst
    // when !penIsDown, turtle is in "calculate" mode, where positions etc. can be calculated without
    // causing anything to be added to HypCanvas's render list.
    private _penIsDown: boolean = false;
    private _strokeStyle: string = "#000";
    private _fillStyle: string = "#000";;
    // sends the origin and the +x vector to the turtle location and forward vector.
    private xform: Xform = Xform.identity;
    constructor(canvas: HypCanvas) {
        this.canvas = canvas;
        Object.seal(this);
    }
    clone(): Turtle {
        const t = new Turtle(this.canvas);
        t.xform = this.xform;
        t._penIsDown = this.penIsDown;
        t._strokeStyle = this._strokeStyle;
        t._fillStyle = this._fillStyle;
        return t;
    }
    rotate(radians: number): void {
        this.xform = this.xform.compose(Xform.rotate(radians));
    }
    forward(distance: number): void {
        // turtle-local end point of line, as if turtle was homed.
        const offset = HypCanvas.polar(distance, 0);
        this.move(offset);
    }

    // Assuming turtle is at home position (at origin, pointing right), move it to offset.
    // So offset is the movement relative to the Turtle's reference frame.
    move(offset: Complex): void {
        // start point of line
        const start = this.xform.xform(Complex.zero);
        const fwd = Xform.originToPoint(offset);
        const newXform = this.xform.compose(fwd);
        const end = newXform.xform(Complex.zero);
        if (this.penIsDown) {
            this.canvas.pushInst(new LineTo(end));
            this.canvas.pushInst(new DoStroke());
            this.canvas.pushInst(new BeginPath());
        }
        this.xform = newXform;
    }

    get penIsDown() {
        return this._penIsDown;
    }
    penDown() {
        if (!this._penIsDown) {
            this.canvas.pushInst(new BeginPath());
            this.canvas.pushInst(new MoveTo(this.position()));
            this._penIsDown = true;
        }
    }
    penUp() {
        if (this._penIsDown) {
            this._penIsDown = false;
        }
    }
    position(): Complex {
        return this.xform.xform(Complex.zero);
    }
    idealPosition(): Complex {
        return this.xform.xform(Complex.one);
    }
    // rfr stands for 'rotate, forward, rotate'.
    // Given another turtle, determine values such that
    // this.rotate(rot1); this.forward(forward); this.rotate(rot2);
    // will place this turtle identically to other.
    rfr(other: Turtle): { rot1: number, forward: number, rot2: number } | null {
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
    stroke() {
        this.canvas.pushInst(new DoStroke());
    }
    set strokeStyle(s: string) {
        this.canvas.pushInst(new SetStroke(s));
        this._strokeStyle = s;
    }
    get strokeStyle(): string {
        return this._strokeStyle;
    }
    fill() {
        this.canvas.pushInst(new DoFill());
    }
    set fillStyle(s: string) {
        this.canvas.pushInst(new SetFill(s));
        this._fillStyle = s;
    }
    get fillStyle(): string {
        return this._fillStyle;
    }
    relPolygon(ps: Complex[]) {
        this.canvas.pushInst(new BeginPath());
        if (ps.length > 0) {
            this.canvas.pushInst(new MoveTo(this.xform.xform(ps[0])));
        }
        for (let i = 1; i < ps.length; i++) {
            this.canvas.pushInst(new LineTo(this.xform.xform(ps[i])));
        }
        if (ps.length > 0) {
            this.canvas.pushInst(new LineTo(this.xform.xform(ps[0])));
        }
    }
    home(): void {
        const p = this.position();
        const x = Xform.originToPoint(p);
        this.xform = x;
        // We have now effectively canceled out our rotation without moving.
        // Using move() here takes care of lines, pen management, etc.
        this.move(p.neg());
        // this is redundant, I think.
        this.xform = Xform.identity;
    }
    relativePosition(p: Complex): Complex {
        return this.xform.invert().xform(p);
    }
    aimAt(p: Complex): void {
        const rp = this.relativePosition(p);
        if (rp.magSq() < 0.000000001) {
            throw new Error("point is too nearby to aim at");
        }
        const bearing = Math.atan2(rp.b, rp.a);
        this.rotate(bearing);
    }


}


