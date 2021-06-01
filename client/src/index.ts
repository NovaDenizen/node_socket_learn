import socket_client from "socket.io-client";
import Complex from "./Complex";
import { HypCanvas, Turtle } from "./HypCanvas";
import { PolygonGeometry as PG } from "./PolygonGeometry";

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

const hc = new HypCanvas({ size: 500 });
const logger = (s: string) => { socket.emit("clientlog", s); };
hc.logger = logger;
document.body.appendChild(hc.makeCanvas());
const p = document.createElement("p");

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
    for (let ri = 1; ri < n; ri++) {
        for (let thetai = 0; thetai < n; thetai++) {
            // radial line
            let r = deltaR * ri;
            let theta = deltaTheta * thetai;
            // the 'base' point
            let x = HypCanvas.polar(r, theta);
            // the point inward
            let y = HypCanvas.polar(r - deltaR, theta);
            hc.addLine(x, y);
            // the next circumferential point
            let z = HypCanvas.polar(r, theta + deltaTheta);
            hc.addLine(x, z);
        }
    }
};
makeButton("spiderweb", drawSpiderweb);


const drawSimple = () => {
    // draw a few attempted euclidean squares
    const deltaDist = 0.1;
    const n = 10;
    hc.reset();
    for (let i = 1; i <= n; i++)
    {  // trace some incomplete squares, 
        const t = hc.turtle();
        const d = i * deltaDist;
        const turn = Math.PI/2;
        t.penDown();
        t.forward(d);
        t.rotate(turn);
        t.forward(d);
        t.rotate(turn);
        t.forward(d);
        t.rotate(turn);
        t.forward(d);
        t.rotate(turn);
    }
};
makeButton("Simple", drawSimple);


const drawSimplePolygons = (sides: number, order: number, depth: number) => {
    const geom = new PG(sides, order);
    const e = geom.edgeLength;
    const r = geom.vertexRadius;
    const turn = geom.externalAngle;
    hc.reset();
    let centerCache: Complex[] = [];
    let verts: Complex[] = [];
    {
        const t = hc.turtle();
        for(let i = 0; i < sides; i++) {
            verts.push(t.position());
            t.forward(e);
            t.rotate(turn);
        }
    }
    let fifo: [Turtle, number][] = [];
    {
        // move turtle to position so that first poly is centered on origin.
        let t = hc.turtle();
        t.forward(geom.vertexRadius);
        t.rotate(Math.PI - geom.internalAngle/2);

        fifo.push([t, depth]);
    }
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    while (fifo.length > 0) {
        const [t, depth] = fifo.shift()!; // '!' is kosher since we check fifo.length
        let newCenter;
        let skip = false;
        {
            const t2 = t.clone();
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
        t.relPolygon(verts);
        t.fillStyle = styles[depth];
        t.fill();
        t.stroke();
        //logger(`drew at ${t.position()} with depth ${depth}`);
        if (depth > 0) {
            t.rotate(geom.internalAngle);
            for (let i = 0; i < sides; i++) {
                fifo.push([t.clone(), depth-1]);
                //logger(`pushed [${t.position()}, ${depth-1}] now fifo.length==${fifo.length}`);
                t.forward(e);
                t.rotate(-turn);
            }
        }
    }
}
makeButton("Squares", () =>drawSimplePolygons(4, 5, 4));
makeButton("Pentagons", () =>drawSimplePolygons(5, 4, 4));
makeButton("Heptagons", () => drawSimplePolygons(7, 3, 4));
makeButton("Heptagons dual", () => drawSimplePolygons(3, 7, 8));


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
        t.relPolygon([leftIdeal, bottomRightIdeal, topRightIdeal]);
        t.fill();
    }
};


document.body.appendChild(p);

//drawHeptagonEdgeTree();
drawSpiderweb();


//console.log("index.ts is done");

