
import * as fs from 'fs';
import express from 'express';
import { Application, Request, Response } from 'express';
import socket_io from 'socket.io';
import { Socket } from 'socket.io';
import * as pg from 'pg';

const https = require('https');
const app = express();
const path = require('path');

const cwd = process.cwd();

const CFG = {
    PG_IPC_PATH: '/var/run/postgresql',
    CERT_PATH: cwd + '/certs',
    SERVER_PORT: 58001,
}

const https_options = {
    key: fs.readFileSync(path.join(CFG.CERT_PATH, 'file.pem')),
    cert: fs.readFileSync(path.join(CFG.CERT_PATH, '/file.crt')),
}

const server = https.createServer(https_options, app);
const io = require('socket.io')(server);

app.use('/modules', express.static(path.join(cwd, 'modules')))

app.get('/', function(req: express.Request, res: express.Response) {
    res.sendFile(path.join(cwd, '/client.html'));
});

async function make_pg_client() {
    const client = new pg.Client({ host: CFG.PG_IPC_PATH});
    await client.connect();
    return client;
} 

async function sendnewdata(socket: Socket) {
    let rows = await basic_query('SELECT idx, x, y from test1 order by idx desc');
    socket.emit('newdata', rows);
}

async function send_origins(socket: Socket) {
    let rows = await basic_query('select tile, description from origins');
    socket.emit('origins', rows);
}

async function basic_query(query: string): Promise<Array<any>> {
    var client;
    try {
        client = await make_pg_client();
        const result: pg.QueryResult = await client.query(query);
        return result.rows;
    } finally {
        if (client) {
            client.end();
        }
    }
}

io.on('connection', function(socket: Socket) {
    console.log(`new connection id=${socket.id}`);
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

