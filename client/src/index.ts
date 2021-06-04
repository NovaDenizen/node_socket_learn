import socket_client from "socket.io-client";
import Complex from "./Complex";
import { HypCanvas, Drawer, Turtle, FrameTransition, Anchor, WorldMap } from "./HypCanvas";
import { PolygonGeometry as PG } from "./PolygonGeometry";
import DiskTurtle from "./DiskTurtle";

const x = new HypCanvas();

const URL_SERVER = "https://www.cymbym.com:58001";
const socket = socket_client(URL_SERVER);


socket.on("message", (data: any) => {
    alert(data);
});
socket.on("xnewdata", (data: any[]) => {
    const ndDiv = document.getElementById("newdata");
    if (ndDiv) {
        ndDiv.textContent = "";
        for (const row of data) {
            let line = "";
            for (const [key, value] of Object.entries(row)) {
                line = line + ` ${key}:${value}`;
            }
            const node = document.createTextNode(line);
            const p = document.createElement("p");
            p.appendChild(node);
            ndDiv.appendChild(p);
        }
    }
});

const newdatabutton = document.getElementById("newdatabutton");
if (newdatabutton) {
    newdatabutton.onclick = () => {
        socket.emit("getnewdata");
    };
}

const hc = new HypCanvas({ size: 400 });
const logger = (s: string) => { socket.emit("clientlog", s); };
hc.logger = logger;
document.body.appendChild(hc.makeCanvas());
let p = document.createElement("p");

const makeButton = (name: string, call: () => void) => {
    const b = document.createElement("input");
    b.value = name;
    b.type = "button";
    b.onclick = call;
    p.appendChild(b);
}
const randomStyle = () => {
    const brightRandom = () => Math.floor(Math.max(Math.random(), Math.random()) * 256);
    const r = brightRandom();
    const g = brightRandom();
    const b = brightRandom();
    return `rgb(${r},${g},${b})`;
}

const drawSpiderweb = () => {
    const n = 20;
    const deltaR = 5 / n;
    hc.reset();
    let deltaTheta = Math.PI * 2 / n;
    const drawer = (d: Drawer) => {
        for (let ri = 1; ri < n; ri++) {
            for (let thetai = 0; thetai < n; thetai++) {
                // radial line
                let r = deltaR * ri;
                let theta = deltaTheta * thetai;
                // the 'base' point
                let x = HypCanvas.polar(r, theta);
                // the point inward
                let y = HypCanvas.polar(r - deltaR, theta);
                d.drawLine(x, y);
                // the next circumferential point
                let z = HypCanvas.polar(r, theta + deltaTheta);
                d.drawLine(x, z);
            }
        }
    }
    hc.addDrawFunc(drawer);
    logger("spiderweb using new drawer");
};
makeButton("spiderweb", drawSpiderweb);




const drawSimplePolygons = (sides: number, order: number, depth: number, opts?: any) => {
    const styles: string[] = (opts && opts.styles) || 
            ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    const geom = new PG(sides, order);
    const e = geom.edgeLength;
    const r = geom.vertexRadius;
    const turn = geom.externalAngle;
    hc.reset();
    let centerCache: Complex[] = [];
    let polys: [Complex[], string][] = [];
    let verts: Complex[] = [];
    {
        const t = new DiskTurtle();
        for(let i = 0; i < sides; i++) {
            verts.push(t.position());
            t.forward(e);
            t.rotate(turn);
        }
    }
    let fifo: [DiskTurtle, number][] = [];
    {
        // move turtle to position so that first poly is centered on origin.
        let t = new DiskTurtle();
        t.forward(geom.vertexRadius);
        t.rotate(Math.PI - geom.internalAngle/2);

        fifo.push([t, depth]);
    }
    while (fifo.length > 0) {
        const [t, depth] = fifo.shift()!; // '!' is kosher since we check fifo.length
        let newCenter;
        let skip = false;
        {
            const t2 = new DiskTurtle(t);
            t2.forward(geom.edgeLength/2);
            t2.rotate(Math.PI/2);
            t2.forward(geom.edgeRadius); 
            // now t2 is at the center of the polygon we're about to draw
            newCenter = t2.position();
            // yes, this is O(n^2) but I don't anticipate having more than a couple hundred polys here.
            // and it only happens when drawing a new figure.
            for (const c of centerCache) {
                if (HypCanvas.metric(newCenter, c) < geom.edgeRadius) {
                    // we already have this one
                    skip = true;
                    break;
                }
            }
        }
        if (skip) {
            continue;
        }

        // store the new center
        centerCache.push(newCenter);
        let newpoly: Complex[] = [];
        for (const v of verts) {
            newpoly.push(t.xform.xform(v));
        }
        polys.push([newpoly, styles[depth % styles.length]]);
        if (depth > 0) {
            t.rotate(geom.internalAngle);
            for (let i = 0; i < sides; i++) {
                fifo.push([new DiskTurtle(t), depth-1]);
                //logger(`pushed [${t.position()}, ${depth-1}] now fifo.length==${fifo.length}`);
                t.forward(e);
                t.rotate(-turn);
            }
        }
    }

    const drawer = (d: Drawer) => {
        for (const [verts, style] of polys) {
            d.drawPoly(verts, { fillStyle: style, strokeStyle: "black" });
        }
    };
    hc.addDrawFunc(drawer);
}
makeButton("Squares", () => drawSimplePolygons(4, 5, 4));
makeButton("Squares-6", () => drawSimplePolygons(4, 6, 4, { styles: ["black", "white"] }));
makeButton("Pentagons", () => drawSimplePolygons(5, 4, 4, { styles: ["black", "white"] }));
makeButton("Hexagons-6", () => drawSimplePolygons(6, 6, 2));
makeButton("Heptagons", () => drawSimplePolygons(7, 3, 4));
makeButton("Triangles-7", () => drawSimplePolygons(3, 7, 8));
makeButton("Triangles-8", () => drawSimplePolygons(3, 8, 6, { styles: ["black", "white"] }));


const drawInfinityPie = () => {
    hc.reset();
    const slices = 30;
    const angle = Math.PI*2/slices;
    const t = hc.turtle();
    const styles = ["red", "white", "blue"];
    for (let i = 0; i < slices; i++) {
        const ideal1 = t.idealPosition();
        t.rotate(angle);
        const ideal2 = t.idealPosition();
        hc.addPolygonPath([Complex.zero, ideal1, ideal2]);

        const styleIdx = i % styles.length;
        t.fillStyle = styles[styleIdx];
        t.fill();
    }
};

document.body.appendChild(p);
p = document.createElement("p");

makeButton("Infinity Pie", drawInfinityPie);

const drawIdealRays = () => {
    hc.reset();
    const delta = 0.25;
    const n = 8;
    let leftIdeal = new Complex(-1, 0);
    let t = hc.turtle();
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    for(let i = -n; i < n; i++) {
        t.penUp();
        t.home();
        let bottom = HypCanvas.polar(delta*i, Math.PI/2); 
        let top = HypCanvas.polar(delta*(i+1), Math.PI/2);
        t.move(top);
        t.aimAt(leftIdeal);
        t.rotate(Math.PI)
        const topRightIdeal = t.idealPosition();
        t.home();
        t.move(bottom);
        t.aimAt(leftIdeal);
        t.rotate(Math.PI)
        const bottomRightIdeal = t.idealPosition();
        t.home();
        t.fillStyle = styles[(i + n) % styles.length];
        t.relPolygon([leftIdeal, bottom, bottomRightIdeal, topRightIdeal, top]);
        t.fill();
    }
};
makeButton("Ideal Rays", drawIdealRays);

const idealFan = (startAng: number, endAng: number, focus: Complex, n: number) => {
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    const t = hc.turtle();
    let range = endAng - startAng;
    let deltaAng = range/n;
    for(let i = 0; i < n; i++) {
        let a1 = startAng + deltaAng*i;
        let ideal1 = Complex.unit(a1);
        let a2 = a1 + deltaAng;
        let ideal2 = Complex.unit(a2);
        t.fillStyle = styles[i % styles.length];
        t.relPolygon([focus, ideal1, ideal2]);
        t.fill();
    }
};
const dumbbell = () => {
    hc.reset();
    const t = hc.turtle();
    t.forward(0.5);
    const rightFocus = t.position();
    const leftFocus = rightFocus.neg();
    const n = 12;
    idealFan(-Math.PI/2, Math.PI/2, rightFocus, n);
    idealFan(Math.PI/2, 3*Math.PI/2, leftFocus, n);
    // draw the line connecting the focii
    let leftDelta = t.relativePosition(leftFocus);
    t.penDown();
    t.move(leftDelta);
}

makeButton("Dumbbell", dumbbell);

const tripleDumbbell = () => {
    hc.reset();
    const t = hc.turtle();
    t.forward(0.5);
    const f1 = t.position();
    const rot120 = Complex.unit(Math.PI*2/3);
    const f2 = f1.mul(rot120);
    const f3 = f2.mul(rot120);
    const n = 12;
    idealFan(-Math.PI/3, Math.PI/3, f1, n);
    idealFan(Math.PI/3, Math.PI, f2, n);
    idealFan(-Math.PI, -Math.PI/3, f3, n);
    t.home();
    t.relPolygon([f1, f2, f3]);
    t.stroke();
}
makeButton("3Dumbbell", tripleDumbbell);


document.body.appendChild(p);

//drawHeptagonEdgeTree();
drawSpiderweb();

const doInfiniteSqures = () =>
{
    hc.reset();
    const geom = new PG(4, 6);
    const centerDistance = 2*geom.edgeRadius;
    const left = Math.PI/2;
    let squarePts: Complex[] = [];

    const drawSquare = (t: Turtle, fillStyle: string) => {
        t.penDown();
        t.rotate(geom.sliceAngle/2);
        t.forward(geom.vertexRadius);
        t.rotate(Math.PI - geom.internalAngle/2);
        t.penDown();
        t.forward(geom.edgeLength);
        t.rotate(geom.externalAngle);
        t.forward(geom.edgeLength);
        t.rotate(geom.externalAngle);
        t.forward(geom.edgeLength);
        t.rotate(geom.externalAngle);
        t.forward(geom.edgeLength);
        t.fillStyle = fillStyle;
        t.fill();
    };
    const map = new Map([
        [ "black",  { 
            id: "black", 
            neighbors: [
                { id: "white", transition: { bearing: 0, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left*2, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left*3, offset: centerDistance, orientation: 0 }}],
            draw: (t: Turtle) => drawSquare(t, "black")
        }],
        [ "white",  { 
            id: "white", 
            neighbors: [
                { id: "black", transition: { bearing: 0, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left*2, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left*3, offset: centerDistance, orientation: 0 }}],
            draw: (t: Turtle) => drawSquare(t, "white")
        }]
    ]);
    hc.setMap(map, "white");
}


//console.log("index.ts is done");

