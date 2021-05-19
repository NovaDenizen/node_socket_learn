import * as hyp from "./oldindex";
import socket_client from "socket.io-client";

const URL_SERVER = "https://www.cymbym.com:58001";
const socket = socket_client(URL_SERVER);

console.log(hyp.nothing());
const x = new hyp.Complex(2, -3);
console.log(`x = ${x}`);

socket.on("message", (data: any) => {
    alert(data);
});
socket.on("newdata", (data: any[]) => {
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
