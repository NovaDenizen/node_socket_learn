
const fs = require('fs');
const express = require('express');
const pg = require('pg');
const https = require('https');
var app = express();

const CFG = {
    PG_IPC_PATH: '/var/run/postgresql',
    CERT_PATH: __dirname + '/certs',
    SERVER_PORT: 58001,
}

const https_options = {
    key: fs.readFileSync(CFG.CERT_PATH + '/file.pem'),
    cert: fs.readFileSync(CFG.CERT_PATH + '/file.crt'),
}

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
    console.log(`new connection id=${socket.id}`);
    sendnewdata(socket);
    socket.on('getnewdata', function() {
        console.log(`getnewdata from ${socket.id}`);
        sendnewdata(socket);
    });
    socket.on('disconnect', function() {
        console.log(`disconnect from ${socket.id}`);
    });
    //socket.emit('message', 'This is a message from the dark side.');
    //socket.on('disconnect', () => console.log('somebody disconnected'));
});


server.listen(CFG.SERVER_PORT, function() {
    console.log('server up and running at %s port', CFG.SERVER_PORT);
});

