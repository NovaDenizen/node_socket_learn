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
    //drawingElements: Line[];
    pending_redraw: boolean;
    get K() {
        return -1;
    }
    constructor(opts?: any) {
        if (opts && opts.size) {
            this.size = opts.size;
        } else {
            this.size = 500;
        }
        //this.drawingElements = [];
        this.canvas = undefined;
        this.pending_redraw = false;
    }
    post_redraw() {
        if (!this.pending_redraw) {
            requestAnimationFrame(() => this.draw());
            this.pending_redraw = true;
        }
    }
    clear() {}
    make_canvas(): HTMLCanvasElement {
        if (!this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = this.size;
            this.canvas.height = this.size;
        }
        this.post_redraw();
        return this.canvas;
    }
    turtle(): Turtle {
        const hc = this;
        return {
            canvas: hc
        }
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
    }
}

export interface Turtle {
    readonly canvas: HypCanvas;
    /*
    forward(dist: number);
    //backward(dist: number);
    // TODO: goto(point: Point);
    left(degrees: number);
    right(degrees: number);
    home();
    pendown();
    penup();
    color();
    */
}
