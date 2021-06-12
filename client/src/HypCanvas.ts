import Complex from "./Complex";
import MobXform from "./MobXform";
import ScreenXY from "./ScreenXY";

export type Drawer = {
    drawLine(x: Complex, y: Complex, strokeStyle?: string): void;
    drawPoly(ps: Complex[], style?: { fillStyle?: string, strokeStyle?: string }): void;
    drawDumbImage(x: Complex, image: any): void;
}

// bearing, offset, and orientation are the instructions a turtle needs to follow to get from the 
// home position of the current frame to the home position of the other frame.
// t.rotate(bearing); t.forward(offset); t.rotate(orientation);
// This is, of course, equivalent to either a t.move(...); t.rotate(..) or t.rotate(); t.move(..), 
// but in this slightly redundant representation the parameters are real-valued.
export type FrameTransition = { bearing: number, offset: number, orientation: number };
export type Anchor = { id: string, 
                neighbors: { id: string, transition: FrameTransition }[], 
                draw: (t: Drawer) => void
              };
export type WorldMap = Map<string, Anchor>;


/**
 * Implements a turtle graphics canvas for a hyperbolic space, based on the Poincare disk model.
 *
 * TODO: zoom
 * TODO: Model/view separation
 */

// everything with squared magnitude bigger than this is considered an ideal point
const IDEAL_BOUNDARY_MAGSQ: number = 0.999999;
class DiskRenderingContext {
    private hypCanvas: HypCanvas;
    private firstPathPoint: Complex;
    private lastPathPoint: Complex;
    private xOffset: number;
    private yOffset: number;
    private scale: number;
    private ctx2d: CanvasRenderingContext2D;
    private view: MobXform;
    constructor(hypCanvas: HypCanvas, htmlCanvas: HTMLCanvasElement, view: MobXform) {
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
        return this.ctx2d;
    }
    toScreen(p: Complex): ScreenXY {
        const x = p.a * this.scale + this.xOffset;
        const y = -p.b * this.scale + this.yOffset;
        return new ScreenXY(x, y);
    }
    drawImage(p: Complex, img: any): void {
        if (!img) {
            return;
        }
        const SIZE = 30;
        const sp = this.toScreen(this.viewed(p));
        this.ctx().drawImage(img, sp.x - SIZE/2, sp.y - SIZE/2, SIZE, SIZE);
        // TODO: Scale with metric.
        // TODO: Rotate with turtle?
        // TODO: Warp with projection?  Would require GL, textures, etc.
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

        // looking for center c (and possibly r, radius of circle at c) where the circle
        // goes through both a and b, and intersects the unit circule perpendicularly..
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
        if (a.magSq() > IDEAL_BOUNDARY_MAGSQ && b.magSq() > IDEAL_BOUNDARY_MAGSQ) {
            // two ideal points, need to follow the outer edge counterclockwise
            this.drawIdealArc(a, b);
        } else if (Math.abs(det) < 0.00001) {
            // curve is practically straight, so just draw a line.
            this.drawScreenLine(a, b);
        } else {
            // find the center using the above math.
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


export default class HypCanvas {
    private size: number;
    private canvas?: HTMLCanvasElement;
    private drawFuncs: ((d: Drawer) => void)[];

    private pendingRedraw: boolean;
    private view: MobXform;
    private touch?: { id: number, pt: ScreenXY };
    logger: (msg: string) => void;
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        this.size = opts?.size || 500;
        this.canvas = undefined;
        this.pendingRedraw = false;
        this.view = MobXform.identity;
        this.touch = undefined;
        this.logger = (msg) => { /* nothing */ };
        this.drawFuncs = [];
        Object.seal(this);
    }
    postRedraw() {
        if (!this.pendingRedraw) {
            requestAnimationFrame(() => this.draw());
            this.pendingRedraw = true;
        }
    }
    clear() {
        this.drawFuncs = [];
        this.postRedraw();
    }
    reset() {
        this.view = MobXform.identity;
        this.clear();
    }
    makeCanvas(): HTMLCanvasElement {
        if (!this.canvas) {
            const c = document.createElement("canvas");
            this.canvas = c;
            c.width = this.size;
            c.height = this.size;
            c.onmousedown = m => this.mouseInput('mousedown', m);
            c.onmouseup = m => this.mouseInput('mouseup', m);
            c.onmousemove = m => this.mouseInput('mousemove', m);
            c.ontouchcancel = m => this.touchInput('touchcancel', m);
            c.ontouchend = m => this.touchInput('touchend', m);
            c.ontouchmove = m => this.touchInput('touchmove', m);
            c.ontouchstart = m => this.touchInput('touchstart', m);
        }
        this.postRedraw();
        return this.canvas;
    }
    private mouseInput(handler: string, ev: MouseEvent): any {
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
    private touchInput(handler: string, ev: TouchEvent) {
        if (handler === 'touchstart') {
            if (this.touch) {
                // we already have a touch, thank you very much.
                return;
            }
            const t = ev.changedTouches.item(0);
            if (t) {
                this.touch = { id: t.identifier, pt: new ScreenXY(t.clientX, t.clientY) };
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
                        const client = new ScreenXY(t.clientX, t.clientY);
                        this.doScreenMove(this.touch.pt, client);
                        this.touch.pt = client;
                    }
                } else {
                    throw new Error("I can't index arrays");
                }
            }
        } else {
            // this.logger(`got unhandled event ${handler}`);
        }
    }
    private doScreenMove(screenStart: ScreenXY, screenEnd: ScreenXY) {
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
            oToEnd = MobXform.originToPoint(diskEnd);
            startToO = MobXform.pointToOrigin(diskStart);
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
            drawDumbImage: (p: Complex, img: any) => {
                drc.drawImage(p,img);
            }
        };
        Object.freeze(d);
        for (const f of this.drawFuncs) {
            f(d);
        };
        this.pendingRedraw = false;
    }
    private complexToXY(c: Complex): ScreenXY {
        const x = (1 + c.a)*this.size/2;
        const y = (1 - c.b)*this.size/2;
        return { x, y };
    }
    private xyToComplex(p: ScreenXY): Complex {
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



