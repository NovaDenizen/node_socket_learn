import Complex from "./Complex";
import MobXform from "./MobXform";
import ScreenXY from "./ScreenXY";
import AffXform from "./AffXform";
import DiskTurtle from "./DiskTurtle";
import Fifo from "./Fifo";
import { PointBag } from "./PointBag";

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
const SEARCH_RADIUS: number = 0.2;
const DRAW_RADIUS: number = 0.95;
class DiskRenderingContext {
    private hypCanvas: HypCanvas;
    private firstPathPoint: Complex;
    private lastPathPoint: Complex;
    private ctx2d: CanvasRenderingContext2D;
    view: MobXform = MobXform.identity;
    private diskToScreen: AffXform = AffXform.identity;
    private canvas: HTMLCanvasElement;
    constructor(hypCanvas: HypCanvas, htmlCanvas: HTMLCanvasElement, view: MobXform, diskToScreen: AffXform) 
    {
        this.hypCanvas = hypCanvas;
        this.view = view;
        this.firstPathPoint = this.viewed(Complex.zero);
        this.lastPathPoint = this.firstPathPoint;
        this.diskToScreen = diskToScreen;
        const ctx = htmlCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("couldn't create CanvasRenderingContext2D");
        }
        this.canvas = htmlCanvas;
        this.ctx2d = ctx;
    }
    clear() {
        const c = this.ctx();
        // clears the canvas to the background color
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // set the styles to solid black
        c.strokeStyle = "#000";
        c.fillStyle = "#888";
        // set the path to the border of the disk
        c.beginPath();

        c.arc(this.canvas.width/2, this.canvas.height/2, this.diskToScreen.scale(), 0, Math.PI*2);
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
    private screened(p: Complex): ScreenXY {
        return this.diskToScreen.xform(ScreenXY.fromComplex(p));
    }
    ctx(): CanvasRenderingContext2D {
        return this.ctx2d;
    }
    drawImage(p: Complex, img: any): void {
        if (!img) {
            return;
        }
        const SIZE = 60;
        const sp = this.screened(this.viewed(p));
        this.ctx().drawImage(img, sp.x - SIZE/2, sp.y - SIZE/2, SIZE, SIZE);
        // TODO: Scale with metric.
        // TODO: Rotate with turtle?
        // TODO: Warp with projection?  Would require GL, textures, etc.
    }

    moveTo(p: Complex) {
        const xp = this.viewed(p);
        const sp = this.screened(xp);
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
        const sb = this.screened(b);
        this.ctx().lineTo(sb.x, sb.y);
    }
    private drawScreenArc(center: Complex, p1: Complex, p2: Complex) {
        const p1vec = p1.sub(center);
        const p2vec = p2.sub(center);

        const cross = p1vec.a*p2vec.b - p1vec.b*p2vec.a;
        const counterClockwise = cross > 0;
        const radius = p1vec.mag()*this.diskToScreen.scale();

        const centers = this.screened(center);
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
        const centers = this.screened(Complex.zero);
        const insaneStartAngle = -saneStartAngle;
        const insaneEndAngle = -saneEndAngle;
        this.ctx().arc(centers.x, centers.y, this.diskToScreen.scale(), 
            insaneStartAngle, insaneEndAngle, true);
    }
}


class DrawerProxy {
    private drc: DiskRenderingContext;
    constructor(drc: DiskRenderingContext) {
        this.drc = drc;
    }
    drawLine(a: Complex, b: Complex, strokeStyle?: string) {
        this.drc.beginPath();
        this.drc.moveTo(a);
        this.drc.lineTo(b);
        this.drc.ctx().strokeStyle = strokeStyle || "black";
        this.drc.stroke();
    }
    drawPoly(ps: Complex[], style?: { fillStyle?: string, strokeStyle?: string }) {
        if (ps.length == 0) {
            return;
        }
        this.drc.beginPath();
        this.drc.moveTo(ps[0]);
        for (let i = 1; i < ps.length; i++) {
            this.drc.lineTo(ps[i]);
        }
        this.drc.lineTo(ps[0]);
        if (style && style.fillStyle) {
            this.drc.ctx().fillStyle = style.fillStyle;
            this.drc.fill();
        }
        if (style && style.strokeStyle) {
            this.drc.ctx().strokeStyle = style.strokeStyle;
            this.drc.stroke();
        }
    }
    drawDumbImage(p: Complex, img: any) {
        this.drc.drawImage(p,img);
    }
}


export default class HypCanvas {
    private opts?: any;
    private canvas?: HTMLCanvasElement;

    private pendingRedraw: boolean;
    private view: MobXform;
    private touch?: { id: number, pt: ScreenXY };
    // 1:  No touches, waiting for a touch
    // 2:  Touch started outside the disk, so let it pass through
    // 3:  Touch started inside the disk, so handle it.
    private touchState: number = 1;
    logger: (msg: string) => void;
    private diskToScreen: AffXform = AffXform.identity;
    private worldMap: WorldMap;
    private anchor: string;
    private lastDrawTime: number = 0;
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        this.opts = opts;
        this.canvas = undefined;
        this.pendingRedraw = false;
        this.view = MobXform.identity;
        this.touch = undefined;
        this.logger = (msg) => { /* nothing */ };
        this.worldMap = new Map();
        this.anchor = '';
        Object.seal(this);
    }
    postRedraw() {
        if (!this.pendingRedraw) {
            requestAnimationFrame(() => this.draw());
            this.pendingRedraw = true;
        }
    }
    clear() {
        this.worldMap = new Map();
        this.anchor = '';
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
            const size = this.opts?.size || 500;
            c.width = size;
            c.height = size;
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
    private makeDiskToScreen() {
        if (!this.canvas) {
            return;
        }
        const width = this.canvas.width;
        const height = this.canvas.height;
        let screenMid = new ScreenXY(width/2, height/2);
        let size = 0;
        if (width > height) {
            size = height/2;
        } else {
            size = width/2;
        }
        let screenUp = new ScreenXY(screenMid.x, screenMid.y - size);
        let screenRight = new ScreenXY(screenMid.x + size, screenMid.y);
        this.diskToScreen = AffXform.from_zij(screenMid, screenRight, screenUp);
    }
    // TODO: Rejigger view adjustment so that the position at the start of the move and the
    // current poisition determine the view adjustment. I.e., the path taken from start to current
    // is irrelevant.
    // This is annoying because we have to save and manage more state (the start position and view),
    // plus we have to manage interference between mouse and touch stuff.
    // Or we could just assume touches and mouse stuff are mutually exclusive.
    private mouseInput(handler: string, ev: MouseEvent): any {
        if (handler === 'mousedown' && !this.touch) {
            this.touch = { id: 1, pt: new ScreenXY(ev.clientX, ev.clientY) };
        } else if (handler === 'mousemove' || handler === 'mouseup') {
            if (ev.buttons === 0 || !this.touch) {
                this.touch = undefined;
                // no buttons are down, so don't do anything.
                return;
            }
            const screenEnd = new ScreenXY(ev.clientX, ev.clientY);

            this.doScreenMove(this.touch.pt, screenEnd);
            this.touch.pt = screenEnd;
        }
    }
    private touchInput(handler: string, ev: TouchEvent) {
        if (handler === 'touchstart') {
            if (this.touchState == 1) {
                const t = ev.changedTouches.item(0);
                if (!t) {
                    throw new Error("browser can't event");
                }
                const client = new ScreenXY(t.clientX, t.clientY);
                const diskp = this.screenToDisk(client);
                if (diskp.magSq() < 1) {
                    this.touch = { id: t.identifier, pt: client };
                    this.touchState = 3;
                    ev.preventDefault();
                } else {
                    this.touchState = 2;
                }
            }
        } else if ((handler === 'touchend') || (handler === 'touchcancel')) {

            // if an ended touch is our current touch, cancel it.
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const t = ev.changedTouches.item(i);
                // this.logger(`checking changedTouch[${i}] = ${JSON.stringify(t)}`);
                if (!t) {
                    throw new Error("ev.changedTouches isn't working");
                }
                if (this.touchState == 3 && this.touch && t.identifier === this.touch.id) {
                    this.touch = undefined;
                    // this.logger(`touch is now ${JSON.stringify(this.touch)}`);
                    ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
                }
            }
            // if all touches are gone, go back to state 1.
            if (ev.touches.length == 0) {
                this.touchState = 1;
            }
        } else if (handler === 'touchmove') {
            if (this.touchState == 3) {
                ev.preventDefault(); // sometimes I think this throws an exception, so it's at the end.
                if (!this.touch) {
                    // we don't have a touch, so we don't care
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
            }
        } else {
            // this.logger(`got unhandled event ${handler}`);
        }
    }
    // convert a screen point back to corresponding disk point.
    private screenToDisk(p: ScreenXY): Complex {
        return this.diskToScreen.invert().xform(p).toComplex();
    }
    // A mouse or touch has moved from start to end.  Update the view transform accordingly.
    private doScreenMove(screenStart: ScreenXY, screenEnd: ScreenXY): void {
        if (screenStart.x == screenEnd.x && screenStart.y == screenEnd.y) {
            // point hasn't moved, so don't bother.
            return;
        }
        const radiusLimit = 0.9;
        const diskStart = this.screenToDisk(screenStart).clampRadius(radiusLimit);
        const diskEnd = this.screenToDisk(screenEnd).clampRadius(radiusLimit);;
        //this.doDiskMove_acrossIdeals(diskStart, diskEnd);
        this.doDiskMove_throughOrigin(diskStart, diskEnd);
    }
    // performs a view move, in such a way that the line between start and end doesn't change.
    // In other words, we need to find the two ideals on either end of the line connecting
    // start and end, then find the transform that sends start to end and keeps the ideals
    // stationary.
    /*
    private doDiskMove_acrossIdeals(diskStart: Complex, diskEnd: Complex): void {
        const dt = new DiskTurtle();
        dt.move(diskStart);
        dt.aimAt(diskEnd);
        const ideal = dt.idealPosition();
        const viewChange = MobXform.twoPoint(diskStart, ideal, diskEnd, ideal);
        const newView = viewChange.compose(this.view);
        this.view = newView;
        this.postRedraw();
    }*/
    // performs a view move, as a composition of two translations, start->origin and origin->end
    private doDiskMove_throughOrigin(diskStart: Complex, diskEnd: Complex): void {
        // console.log("diskStart ", diskStart, " diskEnd ", diskEnd);
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
        const start = new Date().getTime();
        const canvas = this.canvas;
        this.makeDiskToScreen();
        // console.log(canvas);
        if (!canvas) {
            return;
        }
        const drc = new DiskRenderingContext(this, canvas, this.view, this.diskToScreen);
        drc.clear();
        const d: Drawer = new DrawerProxy(drc);
        Object.freeze(d);
        //this.logger("setting up anchorfifo and drawn");
        //console.log("setting up anchorfifo and drawn");
        const anchorFifo: Fifo<[DiskTurtle, Anchor]> = new Fifo();
        const drawn: PointBag<undefined> = new PointBag();

        const a = this.worldMap.get(this.anchor);
        if (a) {
            anchorFifo.push([new DiskTurtle(this.view), a]);
        }

        let fifoCount = 0;
        // We always need to draw at least one anchor, no matter how close to the edge
        // it is.  Hence this flag.
        let first = true;
        let closest: [number, DiskTurtle, Anchor] | undefined = undefined; 
        while (anchorFifo.length > 0) {
            fifoCount++;
            //this.logger(`anchorFifo.length: ${anchorFifo.length}`);
            //console.log(`anchorFifo.length: ${anchorFifo.length}`);
            const [anchorTurtle, anchor] = anchorFifo.shift()!;
            const pos = anchorTurtle.position();
            const dist = pos.mag();
            if (first || ((dist < DRAW_RADIUS) && (!drawn.any(pos, SEARCH_RADIUS)) )) {
                drc.view = anchorTurtle.xform;
                (anchor.draw)(d);
                drawn.push([pos, undefined]);
                if ((!closest) || (dist < closest[0])) {
                    closest = [dist, anchorTurtle, anchor];
                }
                for (const n of anchor.neighbors) {
                    const t = new DiskTurtle(anchorTurtle);
                    const ft = n.transition;
                    t.rotate(ft.bearing);
                    t.forward(ft.offset);
                    t.rotate(ft.orientation);
                    const a = this.worldMap.get(n.id);
                    if (a) {
                        anchorFifo.push([t, a]);
                    }
                }
            } 
            first = false;
        }
        if (closest) {
            const newAnchor = closest[2].id;
            const newXform = closest[1].xform;
            if (closest[2].id != this.anchor) {
                // this.logger(`old anchor ${this.anchor} at ${this.view}`);
                // this.logger(`new anchor ${newAnchor} at ${newXform}`);
            }
            this.view = newXform;
            this.anchor = newAnchor;
        }
        const end = new Date().getTime();
        const elapsed = end - start;
        const drawPeriod = start - this.lastDrawTime;
        this.lastDrawTime = start;
        this.logger(`fifoCount=${fifoCount} drawn.length=${drawn.length} elapsed=${elapsed}ms period=${drawPeriod}`);
        this.pendingRedraw = false;
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
        this.worldMap = wm;
        this.anchor = anchorId;
        this.view = MobXform.identity;
        this.postRedraw();
    }
}

export { HypCanvas };



