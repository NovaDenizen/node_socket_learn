
import * as fs from 'fs';
import express = require('express');
import socket_io = require('socket.io');
import * as pg from 'pg';
import https from 'https';
import path from 'path';

const app = express();

const cfg = new (class CFG {
    CWD: string;
    PG_IPC_PATH: string;
    SERVER_PORT: number;
    constructor() {
        this.CWD = process.cwd();
        this.PG_IPC_PATH = '/var/run/postgresql';
        this.SERVER_PORT = 58001;
        Object.seal(this);
    }
    get CERT_PATH(): string {
        return this.fromDev('certs');
    }
    fromDev(dir: string): string {
        return path.join(this.CWD, dir);
    }
    httpsOptions(): object {
        return {
            key: fs.readFileSync(path.join(this.CERT_PATH, 'file.pem')),
            cert: fs.readFileSync(path.join(this.CERT_PATH, 'file.crt')),
        };
    }
})()


const server = https.createServer(cfg.httpsOptions(), app);
const io = new socket_io.Server(server);

app.use('/modules', express.static(cfg.fromDev('../client/modules')));

app.get('/', (req: express.Request, res: express.Response) => {
    res.sendFile(cfg.fromDev('client.html'));
});

async function make_pg_client(): Promise<pg.Client>{
    const client = new pg.Client({ host: cfg.PG_IPC_PATH});
    await client.connect();
    return client;
}

async function sendnewdata(socket: socket_io.Socket) {
    const rows = await basic_query('SELECT idx, x, y from test1 order by idx desc');
    socket.emit('newdata', rows);
}

async function send_origins(socket: socket_io.Socket) {
    const rows = await basic_query('select tile, description from origins');
    socket.emit('origins', rows);
}

async function basic_query(query: string): Promise<any[]> {
    let client;
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

io.on('connection', (socket: socket_io.Socket) => {
    console.log(`new connection id=${socket.id}`);
    sendnewdata(socket);
    socket.on('getnewdata', () => {
        console.log(`got getnewdata from ${socket.id}`);
        sendnewdata(socket);
    });
    socket.on('getorigins', () => {
        console.log('got getorogins from ${socket.id}');
        send_origins(socket);
    });
    socket.on('disconnect', () => {
        console.log(`disconnect from ${socket.id}`);
    });
});


server.listen(cfg.SERVER_PORT, () => {
    console.log('server up and running at %s port', cfg.SERVER_PORT);
});

