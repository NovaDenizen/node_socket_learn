import Complex from "./Complex";
import Xform from "./Xform";



/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disk model.
 *
 * TODO: enable different K
 * TODO: zoom
 * TODO: Model/view separation
 * TODO: filled regions? paths?
 * TODO: strokes, stroke and fill styles
    going to do it the same as CanvasRenderingContext2D.
    penDown(), penUp(), put turtle into pen mode, every line is drawn as the turtle moves.
    beginPath() puts turtle into path mode.  Moves are stored up.  stroke(), fill(), strokeStyle, 
    fillstyle, closePath() all need to be on the turtle.
    current path needs to be stored on the turtle.
    Maybe the best way to do it is with an instruction model.
    pen mode forward() adds a [MOVE_TO, BEGIN_PATH, LINE_TO, STROKE] sequence.
    setting a stroke style adds a "SET_STROKE_STYLE" instruction.  Similar with SET_FILL_STYLE.
    Not sure what to do with ideal points.  Maybe check if both endpoints on a line are ideal, then go 
    counterclockwise around the edge to connect them.  closePath() will need to handle this.
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
        c.fillStyle = "#eee";
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
        // the right triangle formed by the segment connecting the centers and an intersection point
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
        if (Math.abs(det) < 0.00001) {
            this.drawScreenLine(a, b);
        } else {
            let g = (1 + b.magSq())/2;
            let h = (1 + a.magSq())/2;
            let center = new Complex((g*a.b - b.b*h)/det, (b.a*h - a.a*g)/det);
            this.drawScreenArc(center, a, b);
        }
    }
    beginPath(): void {
        this.ctx().beginPath();
        this.firstPathPoint = this.lastPathPoint;
    }
    stroke() {
        this.ctx().stroke();
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
    constructor() {}
    exec(ctx: DiskRenderingContext): void {
        ctx.beginPath();
    }
}
class Stroke implements RenderInst {
    constructor() {}
    exec(ctx: DiskRenderingContext): void {
        ctx.stroke();
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
        if (diskStart.magSq() > 1) {
            // clamp it to disk
            diskStart = diskStart.scale(0.999/diskStart.mag());
        }
        if (diskEnd.magSq() > 1) {
            // clamp it to disk
            diskEnd = diskEnd.scale(0.999/diskEnd.mag());
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
        // console.log("redrawing, with %d lines", this.lines.length);
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
        this.logger(`addLine(${p1}, ${p2})`);
        this.insts.push(new BeginPath());
        this.insts.push(new MoveTo(p1));
        this.insts.push(new LineTo(p2));
        this.insts.push(new Stroke())
        this.postRedraw();
    }
    pushInst(i: RenderInst): void {
        this.insts.push(i);
        this.postRedraw();
    }
    turtle(): Turtle {
        return new TurtleImpl(this);
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
    position(): Complex;
    idealPosition(): Complex;
    beginPath(): void;
    stroke(): void;
    strokeStyle: string;
    fillStyle: string;
}

class TurtleImpl {
    readonly canvas: HypCanvas;
    penIsDown: boolean = false;
    pathMode: boolean = false;;
    private _strokeStyle: string = "#000";
    private _fillStyle: string = "#000";;
    // sends the origin and the +x vector to the turtle location and forward vector.
    private xform: Xform = Xform.identity;;
    constructor(canvas: HypCanvas) {
        this.canvas = canvas;
        Object.seal(this);
    }
    clone(): Turtle {
        const t = new TurtleImpl(this.canvas);
        t.xform = this.xform;
        t.penIsDown = this.penIsDown;
        return t;
    }
    beginPath(): void {
        this.pathMode = true;
        this.canvas.pushInst(new BeginPath());
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
        const end = newXform.xform(Complex.zero);
        if (this.penIsDown) {
            // end point of line
            if (this.pathMode) {
                this.canvas.pushInst(new LineTo(end));
            } else {
                this.canvas.addLine(start, end);
            }
        } else { // pen is up
            this.canvas.pushInst(new MoveTo(end));
        }
        this.xform = newXform;
    }

    penDown() {
        this.pathMode = false;
        this.penIsDown = true;
    }
    penUp() {
        this.pathMode = false;
        this.penIsDown = false;
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
    rfr(other_gen: Turtle): { rot1: number, forward: number, rot2: number } | null {
        if (!(other_gen instanceof TurtleImpl)) {
            return null;
        }
        const other: TurtleImpl = other_gen;
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
        this.canvas.pushInst(new Stroke());
    }
    set strokeStyle(s: string) {
        this.canvas.pushInst(new SetStroke(s));
        this._strokeStyle = s;
    }
    get strokeStyle(): string {
        return this._strokeStyle;
    }
    set fillStyle(s: string) {
        this.canvas.pushInst(new SetFill(s));
        this._fillStyle = s;
    }
    get fillStyle(): string {
        return this._fillStyle;
    }

}


