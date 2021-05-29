import socket_client from "socket.io-client";
import Complex from "./Complex";
import { HypCanvas, Turtle } from "./HypCanvas";
import { sprintf } from "sprintf-js";

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

// given triangle with angles alpha, beta, gamma, gives the side length of
// the side opposite alpha.
const triangleSideLength: ((alpha: number, beta: number, gamma: number) => number)  = 
    (alpha: number, beta: number, gamma: number) => {
    /*
        hyperbolic law of cosines (k=1):
            for any triangle with internal angles alpha, beta, gamma and side a opposite alpha:
                cos(alpha) = -cos(beta)cos(gamma) + sin(beta)sin(gamma)cosh(a)
                cos(alpha) + cos(beta)cos(gamma) = sin(beta)sin(gamma)cosh(a)
                (cos(alpha) + cos(beta)cos(gamma))/(sin(beta)sin(gamm)) = cosh(a)
                a = arccosh((cos(alpha) + cos(beta)cos(gamma))/(sin(beta)sin(gamm)));
    */
    const cos = Math.cos;
    const sin = Math.sin;
    const a: number = Math.acosh((cos(alpha) + cos(beta)*cos(gamma))/(sin(beta)*sin(gamma)));
    return a;
};

// edgeLength is length of each edge
// vertexRadius is distance from vertex to center of polygon
// edgeRadius is distance from center to center of edge
// internalAngle is internal angle of polygon
// externalAngle is external angle of polygon
// slices is 
type PolyGeometry = 
    { edgeLength: number; 
      internalAngle: number; 
      externalAngle: number; 
      vertexRadius: number; 
      edgeRadius: number;
      sliceAngle: number;
    };

// sides is number of sides in the polygon
// order is number of polygons that meat at each vertex
const uniformPolygonGeometry:  ((sides: number, order: number) => PolyGeometry) 
  = (sides: number, order: number) =>
{
    const internalAngle= 2*Math.PI/order;
    const externalAngle = Math.PI - internalAngle;
    const sliceAngle = 2*Math.PI/sides;
    // A slice triangle has one sliceAngle at the center and two (internalAngle/2) at two vertexes.
    const halfInternal = internalAngle/2;
    const edgeLength = triangleSideLength(sliceAngle, halfInternal, halfInternal);
    const vertexRadius = triangleSideLength(halfInternal, sliceAngle, halfInternal);
    // this uses a half-slice triangle, with angles sliceAngle/2, 90, halfInternal
    const edgeRadius = triangleSideLength(halfInternal, sliceAngle/2, Math.PI/2);
    return {
        edgeLength, internalAngle, externalAngle, vertexRadius, edgeRadius, sliceAngle,
    };
};

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
    const geom = uniformPolygonGeometry(sides, order);
    const e = geom.edgeLength;
    const r = geom.vertexRadius;
    const turn = geom.externalAngle;
    hc.reset();
    let centerCache: Complex[] = [];
    let heptagons: (depth: number, t: Turtle) => void;
    let verts: Complex[] = [];
    {
        const t = hc.turtle();
        for(let i = 0; i < sides; i++) {
            verts.push(t.position());
            t.forward(e);
            t.rotate(turn);
        }
    }
    let styles: string[] = ["red", "orange", "yellow", "green", "blue", "purple", "gray", "black", "pink"];
    const polygons = (depth: number, t: Turtle) => {
        {
            const t2 = t.clone();
            t2.forward(geom.edgeLength/2);
            t2.rotate(Math.PI/2);
            t2.forward(geom.edgeRadius); 
            // now t2 is at the center of the polygon we're about to draw
            const newCenter = t2.position();
            // yes, this is O(n^2) but I don't anticipate having more than a couple hundred polys here.
            // and it only happens when drawing a new figure.
            for (const c of centerCache) {
                if (HypCanvas.metric(newCenter, c) < geom.edgeRadius) {
                    // we already have this one
                    return;
                }
            }
            // store the new center, then proceed
            centerCache.push(newCenter);
        }
        //logger(`heptagons(${depth}, ${t.position()})`);
        t.relPolygon(verts);
        t.fillStyle = styles[depth];
        t.fill();
        t.stroke();
        if (depth > 0) {
            t.rotate(geom.internalAngle);
            for (let i = 0; i < sides; i++) {
                polygons(depth-1, t.clone());
                t.forward(e);
                t.rotate(-turn);
            }
        }
    }
    polygons(depth, hc.turtle());
}
makeButton("Slow hepts", () => drawSimplePolygons(7, 3, 4));
makeButton("Slow hepts dual", () => drawSimplePolygons(3, 7, 6));

const drawHeptagonEdgeTree = () => {
    const e = Math.acosh((Math.cos(2*Math.PI/7) + 0.25) / 0.75);
    const r = Math.acosh((1 + Math.cos(2*Math.PI/7))/(Math.sqrt(3)*Math.sin(2*Math.PI/7)));
    const turn = Math.PI/3; // the external angle, not the internal angle
    hc.reset();
    // Instead of cleverly drawing heptagons, I'm drawing 3 trees of heptagon edges.
    // When an edge doesn't move farther away from the origin, we don't recurse.
    let heptree: (depth: number, t: Turtle) => void;
    heptree = (depth: number, t: Turtle) => {

        const start = t.position();
        t.forward(e);
        const end = t.position();
        if (HypCanvas.origin_metric(end) - HypCanvas.origin_metric(start) > 0.01) {
            hc.addLine(start, end);
            if (depth > 0) {
                {
                    const t_1 = t.clone();
                    t_1.rotate(Math.PI/3);
                    heptree(depth-1, t_1);
                }
                {
                    const t_2 = t.clone();
                    t_2.rotate(-Math.PI/3);
                    heptree(depth-1, t_2);
                }
            }
        } else {
            // only draw a 'horizontal' edge when it goes ccw.
            if (start.a*end.b - end.a*start.b > 0) {
                hc.addLine(start, end);
            }
        }
    }
    let d = 8;
    let t = hc.turtle();
    heptree(d, t.clone());
    t.rotate(Math.PI*2/3);
    heptree(d, t.clone());
    t.rotate(Math.PI*2/3);
    heptree(d, t.clone());
}
makeButton("Fast hepts", drawHeptagonEdgeTree);

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


document.body.appendChild(p);

//drawHeptagonEdgeTree();
drawSpiderweb();


//console.log("index.ts is done");

