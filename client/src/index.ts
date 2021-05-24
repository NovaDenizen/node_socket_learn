import socket_client from "socket.io-client";
import { HypCanvas, Turtle } from "./HypCanvas";

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
document.body.appendChild(hc.makeCanvas());

if (false) {
    const n = 30;
    const deltaR = 8 / n;
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
}

if (false) {
    // draw a few attempted euclidean squares
    const deltaDist = 0.1;
    const n = 10;
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
}
/*
    hyperbolic law of cosines (k=1):
        for any triangle with internal angles alpha, beta, gamma and side a opposite alpha:
            cos(alpha) = -cos(beta)cos(gamma) + sin(beta)sin(gamma)cosh(a)

        For the (7,3) tiling (heptagons meeting 3 at each vertex)
        center a heptagon on the origin.
        consider one of the 7 slices of the heptagon, an iscoceles triangle
        r is the distance from O to a vertex
        e is the outer edge length
        E = 2pi/7, the pie-slice angle at the origin opposite e.
        G = pi/3, half the internal angle of the heptagon.
            this is one of the equal pair of angles in the iscocelese slice triangle

        cos(2pi/7) = -cos(pi/3)cos(pi/3)) + sin(pi/3)sin(pi/3)cosh(e)
        cos(2pi/7) = -1/4 + 3/4*cosh(e)
        cosh(e) = (cos(2pi/7) + 1/4)/(3/4)
        e = arccosh((cos(2pi/7) + 1/4)/(3/4))

        solving for r:
            cos(pi/3) = -cos(pi/3)cos(2pi/7) + sin(pi/3)*sin(2pi/7)*cosh(r)
            1/2 = -1/2 cos(2pi/7) + sqrt(3)/2 * sin(2pi/7)*cosh(r)
            sqrt(3)/2*sin(2pi/7)*cosh(r) = 1/2 + 1/2*cos(2pi/7)
            cosh(r) = (1/2 + 1/2 * cos(2pi/7))/(sqrt(3)/2 * sin(2*pi/7)
                    = (1 + cos(2pi/7))/(sqrt(3)*sin(2*pi/7))
            r = arccosh((1 + cos(2pi/7))/(sqrt(3)*sin(2*pi/7)))
*/

{
    const e = Math.acosh((Math.cos(2*Math.PI/7) + 0.25) / 0.75);
    const r = Math.acosh((1 + Math.cos(2*Math.PI/7))/(Math.sqrt(3)*Math.sin(2*Math.PI/7)));
    const turn = Math.PI/3; // the external angle, not the internal angle
    if (false) {
        let heptagons: (depth: number, t: Turtle) => void;
        heptagons = (depth: number, t: Turtle) => {
            for (let i = 0; i < 7; i++) {
                t.forward(e);
                if (depth > 0) {
                    const t2 = t.clone();
                    t2.rotate(Math.PI);
                    heptagons(depth-1, t2);
                }
                t.rotate(turn);
            }
        }
        const t = hc.turtle();
        t.penDown();
        heptagons(3, t);
    }

    if (true) {
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
}


//console.log("index.ts is done");

