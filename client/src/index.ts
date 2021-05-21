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

const hc = new HypCanvas({ size: 999 });
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

{
    const deltaDist = 0.1;
    const n = 1;
    for (let i = 1; i <= n; i++)
    {  // trace some incomplete squares, 
        const t = hc.turtle();
        const d = i * deltaDist;
        const turn = Math.PI/2;
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


//console.log("index.ts is done");

