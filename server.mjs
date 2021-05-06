
const fs = require('fs');
const express = require('express');
const pg = require('pg');
const https = require('https');
var app = express();

const CFG = {
    PROXY_IPC_PATH: '/home/kbateman/hw_ipc',
    PG_IPC_PATH: '/var/run/postgresql',
    CERT_PATH: '/home/kbateman/prog/node_socket_learn/certs',
}

const https_options = {
    key: fs.readFileSync(CFG.CERT_PATH + '/file.pem'),
    cert: fs.readFileSync(CFG.CERT_PATH + '/file.crt'),
}
const server_port = 58001;

var server = https.createServer(https_options, app);
var io = require('socket.io')(server);


app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client.html');
});

function make_pg_client() {
    return new pg.Client({ host: CFG.PG_IPC_PATH});
}

async function sendnewdata(socket) {
    try {
        const client = make_pg_client();
        await client.connect();
        const qres = await(client.query('SELECT idx, x, y from test1 order by idx desc'));
        await client.end();
        socket.emit('newdata', qres.rows);
    } catch (err) {
        console.log("caught err %s, shutting down", err);
        server.close(() => console.log("server has shut down"));
    } 
}

io.on('connection', function(socket) {
    console.log('new connection');
    sendnewdata(socket);
    socket.on('getnewdata', function() {
        sendnewdata(socket);
    });
    //socket.emit('message', 'This is a message from the dark side.');
    //socket.on('disconnect', () => console.log('somebody disconnected'));
});


server.listen(server_port, function() {
    console.log('server up and running at %s port', server_port);
});

