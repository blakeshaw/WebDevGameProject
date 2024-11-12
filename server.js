import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";

// Express initializes app to be a function handler that can supply to an HTTP server
const app = express();
const server = createServer(app);
const io = new Server(server); // Initialize a new instance of socket.io by passing the server (the HTTP server) object 

const __dirname = dirname(fileURLToPath(import.meta.url));

// define a route handler / that gets called when we hit website home
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Then listen on the connection event for incoming sockets and log it to the console
io.on('connection', (socket) => {
    console.log("a user connected")
    socket.on('disconnect', () => {
        console.log("a user disconnected");
    });
})

server.listen(3099, () => {
  console.log('server running at http://localhost:3099');
});