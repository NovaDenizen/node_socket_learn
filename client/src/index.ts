
import * as hyp from './oldindex';
import socket_client from 'socket.io-client';

var URL_SERVER = 'https://www.cymbym.com:58001';
var socket = socket_client(URL_SERVER);

console.log(hyp.nothing());
let x = new hyp.Complex(2, -3);
console.log(`x = ${x}`); 


socket.on('message', function(data) {
alert(data);
});
socket.on('newdata', function(data) {
    console.log('got newdata(%o)', data);
    let nd_div = document.getElementById('newdata');
    if (nd_div) {
        nd_div.textContent = '';
        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            let line = '';
            for (let [key, value] of Object.entries(row)) {
                line = line + ` ${key}:${value}`;
            }
            const node = document.createTextNode(line);
            const p = document.createElement('p');
            p.appendChild(node);
            nd_div.appendChild(p);
        }
    }
});
let newdatabutton = document.getElementById('newdatabutton');
if (newdatabutton) {
    newdatabutton.onclick = function() {
        socket.emit('getnewdata');
    };
}

