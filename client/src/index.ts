import socket_client from "socket.io-client";
import HypCanvas from "./HypCanvas";

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

        cos(2pi/7) = -cos(pi/3)cos(pi/3)) + sin(pi/3)sin(pi/3)cosh(e)
        cos(2pi/7) = -1/4 + 3/4*cosh(e)
        cosh(e) = (cos(2pi/7) + 1/4)/(3/4)
        e = arccosh((cos(2pi/7) + 1/4)/(3/4))
*/

{
    let e = Math.acosh((Math.cos(2*Math.PI/7) + 0.25) / 0.75);
    let turn = Math.PI/3; // the external angle, not the internal angle
    const t = hc.turtle();
    t.penDown();
    for (let i = 0; i < 7; i++) {
        t.forward(e);
        t.rotate(turn);
    }
}


//console.log("index.ts is done");

