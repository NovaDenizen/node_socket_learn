import socket_client from "socket.io-client";
import Complex from "./Complex";
import { HypCanvas, Drawer, FrameTransition, Anchor, WorldMap } from "./HypCanvas";
import { PolygonGeometry as PG } from "./PolygonGeometry";
import DiskTurtle from "./DiskTurtle";
import Fifo from "./Fifo";
import { PointBag } from "./PointBag";

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

const hc = new HypCanvas({ size: 800 });
const logger = (s: string) => { socket.emit("clientlog", s); };
hc.logger = logger;
{
    const canvas = hc.makeCanvas();
    document.body.appendChild(canvas);
}
let p = document.createElement("p");

const makeCanvasImage: (src: string) => any = (src) => {
    const img = document.createElement('img');
    img.width = 30;
    img.height = 30;
    img.src = src;
    img.onload = () => hc.postRedraw();
    return img;
};


const origin_img = makeCanvasImage("origin.svg");
p.appendChild(origin_img);

const billy_img = makeCanvasImage("billy_cropped.png");
p.appendChild(billy_img);

const makeAnchor = (id: string, drawer: (d: Drawer) => void) => {
    return {
            id,
            neighbors: [],
            draw: drawer 
    }
}


const makeButton = (name: string, anchor: Anchor) => {
    const b = document.createElement("input");
    b.value = name;
    b.type = "button";
    const wm = makeMap([anchor]);

    b.onclick = () => { hc.setMap(wm, anchor.id) };
    b.id = name;
    p.appendChild(b);
    return b;
}

const makeMapButton = (name: string, map: WorldMap, startAnchor: string) => {
    const b = document.createElement("input");
    b.value = name;
    b.type = "button";
    b.id = name;

    b.onclick = () => { hc.setMap(map, startAnchor) };
    p.appendChild(b);
    return b;
}

const makeMap = (anchors: Anchor[]) => {
    let wm = new Map();
    for (const anc of anchors) {
        wm.set(anc.id, anc);
    }
    return wm;
}

const makeAnchorAndButton = (name: string, drawer: (d: Drawer) => void) => {
    makeButton(name, makeAnchor("default", drawer));
}

const randomStyle = () => {
    const brightRandom = () => Math.floor(Math.max(Math.random(), Math.random()) * 256);
    const r = brightRandom();
    const g = brightRandom();
    const b = brightRandom();
    return `rgb(${r},${g},${b})`;
}

{
    const n = 12;
    const deltaR = 5 / n;
    let deltaTheta = Math.PI * 2 / n;
    let lines: [Complex, Complex, Complex][] = [];
    for (let ri = 1; ri < n; ri++) {
        for (let thetai = 0; thetai < n; thetai++) {
            // radial line
            let r = deltaR * ri;
            let theta = deltaTheta * thetai;
            // the 'base' point
            let x = HypCanvas.polar(r, theta);
            // the point inward
            let y = HypCanvas.polar(r - deltaR, theta);
            // the next circumferential point
            let z = HypCanvas.polar(r, theta + deltaTheta);
            lines.push([x, y, z]);
        }
    }
    const drawer = (d: Drawer) => {
        for (const [x, y, z] of lines) {
            d.drawLine(x, y);
            d.drawLine(x, z);
        }
        d.drawDumbImage(Complex.zero, billy_img);
    }
    let anchor = makeAnchor("default", drawer);
    makeButton("spiderweb", anchor);
    hc.setMap(makeMap([anchor]), "default");
};



type DrawFunc = (d: Drawer) => void;

const drawSimplePolygons: (sides: number, order: number, depth: number, opts?: any) => DrawFunc 
    = (sides: number, order: number, depth: number, opts?: any) => {
    const styles: string[] = (opts && opts.styles) || 
            ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    const geom = new PG(sides, order);
    const e = geom.edgeLength;
    const r = geom.vertexRadius;
    const turn = geom.externalAngle;
    let centerCache: PointBag<null> = new PointBag();
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
    let fifo: Fifo<[DiskTurtle, number]> = new Fifo();
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
            if (centerCache.any(newCenter, geom.edgeRadius)) {
                skip = true;
            }
        }
        if (skip) {
            continue;
        }

        // store the new center
        centerCache.push([newCenter, null]);
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
        d.drawDumbImage(Complex.zero, billy_img);
    };
    return drawer;
}
makeAnchorAndButton("Squares", drawSimplePolygons(4, 5, 4));
makeAnchorAndButton("Squares-6", drawSimplePolygons(4, 6, 4, { styles: ["black", "white"] }));
makeAnchorAndButton("Pentagons", drawSimplePolygons(5, 4, 4, { styles: ["black", "white"] }));
makeAnchorAndButton("Hexagons-6", drawSimplePolygons(6, 6, 2));
makeAnchorAndButton("Heptagons", drawSimplePolygons(7, 3, 4));
makeAnchorAndButton("Triangles-7", drawSimplePolygons(3, 7, 8));
makeAnchorAndButton("Triangles-8", drawSimplePolygons(3, 8, 6, { styles: ["black", "white"] }));
makeAnchorAndButton("BioHazerd", drawSimplePolygons(10, 6, 2, { styles: ["black", "yellow"]}));


document.body.appendChild(p);
p = document.createElement("p");

{
    const slices = 30;
    const angle = Math.PI*2/slices;
    const t = new DiskTurtle();
    const styles = ["red", "white", "blue"];
    let polys: [Complex[], any][] = [];
    for (let i = 0; i < slices; i++) {
        const ideal1 = t.idealPosition();
        t.rotate(angle);
        const ideal2 = t.idealPosition();
        const styleIdx = i % styles.length;
        const fillStyle = styles[styleIdx];
        polys.push([[Complex.zero, ideal1, ideal2], { fillStyle }]);
    }
    const drawer = (d: Drawer) => {
        for (const [p, style] of polys) {
            d.drawPoly(p, style);
        }
    }
    makeAnchorAndButton("Infinity Pie", drawer);
};


{
    const delta = 0.25;
    const n = 8;
    let leftIdeal = new Complex(-1, 0);
    let t = new DiskTurtle();
    let polys: [Complex[], any][] = [];
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    for(let i = -n; i < n; i++) {
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
        const fillStyle = styles[(i + n) % styles.length];
        polys.push([[leftIdeal, bottom, bottomRightIdeal, topRightIdeal, top], { fillStyle }]);
    }
    const drawer = (d: Drawer) => {
        for (const [p, style] of polys) {
            d.drawPoly(p, style);
        }
    };
    makeAnchorAndButton("Ideal Rays", drawer);
};

const idealFan: (startAng: number, endAng: number, focus: Complex, n: number) => DrawFunc = 
    (startAng: number, endAng: number, focus: Complex, n: number) => {
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    let range = endAng - startAng;
    let deltaAng = range/n;
    let polys: [Complex[], any][] = [];
    for(let i = 0; i < n; i++) {
        let a1 = startAng + deltaAng*i;
        let ideal1 = Complex.unit(a1);
        let a2 = a1 + deltaAng;
        let ideal2 = Complex.unit(a2);
        const fillStyle = styles[i % styles.length];
        polys.push([[focus, ideal1, ideal2], { fillStyle }]);
    }
    const drawer = (d: Drawer) => {
        for (const [p, style] of polys) {
            d.drawPoly(p, style);
        }
    };
    return drawer;
};
{
    const t = new DiskTurtle();
    t.forward(0.5);
    const rightFocus = t.position();
    const leftFocus = rightFocus.neg();
    const n = 12;
    const fan1 = idealFan(-Math.PI/2, Math.PI/2, rightFocus, n);
    const fan2 = idealFan(Math.PI/2, 3*Math.PI/2, leftFocus, n);
    const drawer = (d: Drawer) => {
        fan1(d);
        fan2(d);
        d.drawLine(leftFocus, rightFocus);
    };
    // draw the line connecting the focii
    makeAnchorAndButton("Dumbbell", drawer);
}


{
    const t = new DiskTurtle();
    t.forward(0.5);
    const f1 = t.position();
    const rot120 = Complex.unit(Math.PI*2/3);
    const f2 = f1.mul(rot120);
    const f3 = f2.mul(rot120);
    const n = 12;
    const fan1 = idealFan(-Math.PI/3, Math.PI/3, f1, n);
    const fan2 = idealFan(Math.PI/3, Math.PI, f2, n);
    const fan3 = idealFan(-Math.PI, -Math.PI/3, f3, n);

    const drawer = (d: Drawer) => {
        fan1(d);
        fan2(d);
        fan3(d);
        d.drawPoly([f1, f2, f3], { strokeStyle: "black" });
    };
    makeAnchorAndButton("3Dumbbell", drawer);
}


document.body.appendChild(p);

//drawHeptagonEdgeTree();
//drawSpiderweb();

{
    const geom = new PG(4, 6);
    const centerDistance = 2*geom.edgeRadius;
    const left = Math.PI/2;
    let squarePts: Complex[] = [];
    {
        const t = new DiskTurtle();
        t.rotate(geom.sliceAngle/2);
        t.forward(geom.vertexRadius);
        t.rotate(Math.PI - geom.internalAngle/2);
        squarePts.push(t.position());
        t.forward(geom.edgeLength);
        squarePts.push(t.position());
        t.rotate(geom.externalAngle);
        t.forward(geom.edgeLength);
        squarePts.push(t.position());
        t.rotate(geom.externalAngle);
        t.forward(geom.edgeLength);
        squarePts.push(t.position());
    }

    const drawSquare = (d: Drawer, fillStyle: string) => {
        d.drawPoly(squarePts, { fillStyle });
        d.drawDumbImage(Complex.zero, billy_img);
    };
    const map = new Map([
        [ "black",  { 
            id: "black", 
            neighbors: [
                { id: "white", transition: { bearing: 0, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left*2, offset: centerDistance, orientation: 0 }},
                { id: "white", transition: { bearing: left*3, offset: centerDistance, orientation: 0 }}],
            draw: (d: Drawer) => drawSquare(d, "black")
        }],
        [ "white",  { 
            id: "white", 
            neighbors: [
                { id: "black", transition: { bearing: 0, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left*2, offset: centerDistance, orientation: 0 }},
                { id: "black", transition: { bearing: left*3, offset: centerDistance, orientation: 0 }}],
            draw: (d: Drawer) => drawSquare(d, "white")
        }]
    ]);
    makeMapButton("Infinite Billys", map, "white");
    // makes Infinite Billys the active view.
    hc.setMap(map, "white");
}

function constFn<G, H>(g: G): (h: H) => G {
    return ((h: H) => g);
}



//console.log("index.ts is done");

