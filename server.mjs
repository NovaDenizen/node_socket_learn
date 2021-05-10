
const fs = require('fs');
const express = require('express');
const pg = require('pg');
const https = require('https');
const app = express();

const CFG = {
    PG_IPC_PATH: '/var/run/postgresql',
    CERT_PATH: __dirname + '/certs',
    SERVER_PORT: 58001,
}

const https_options = {
    key: fs.readFileSync(CFG.CERT_PATH + '/file.pem'),
    cert: fs.readFileSync(CFG.CERT_PATH + '/file.crt'),
}

const server = https.createServer(https_options, app);
const io = require('socket.io')(server);


app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client.html');
});

async function make_pg_client() {
    const client = new pg.Client({ host: CFG.PG_IPC_PATH});
    await client.connect();
    return client;
} 

async function sendnewdata(socket) {
    try {
        let rows = await basic_query('SELECT idx, x, y from test1 order by idx desc');
        socket.emit('newdata', rows);
    } catch (err) {
        console.log('sendnewdata caught ' + err);
    }
}

async function send_origins(socket) {
    let qres = await(basic_query('select tile, description from origins'));
    socket.emit('origins', qres.rows);
}

async function basic_query(query) {
    var client;
    try {
        client = await make_pg_client();
        const result = await client.query(query);
        return result.rows;
    } finally {
        client.end();
    }
}

io.on('connection', function(socket) {
    console.log(`new connection id=${socket.id}`);
    socket.emit('newdata', [{ message: 'initial nondata'}]);
    sendnewdata(socket);
    socket.on('getnewdata', function() {
        console.log(`got getnewdata from ${socket.id}`);
        sendnewdata(socket);
    });
    socket.on('getorigins', function() {
        console.log('got getorogins from ${socket.id}');
        send_origins(socket);
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

