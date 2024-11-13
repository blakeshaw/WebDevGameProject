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

// global variables
let player = {};
let width = 5000;
let height = 5000;

// define a route handler / that gets called when we hit website home
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'html/index.html'));
});

// Define a route handler for the game page
app.get('/game', (req, res) => {
  res.sendFile(join(__dirname, 'html/game.html'));
});

// Then listen on the connection event for incoming sockets and log it to the console
io.on('connection', (socket) => {
    console.log("user " + socket.id + " connected")
    socket.on('client-id', async(id) => {
      player[socket.id] = {
        x: Math.random() * width,
        y: Math.random() * height,
        health: 3,
        score: 0
      }
      console.log(player[socket.id]);
    });
    socket.on('disconnect', () => {
        console.log("user " + socket.id + " disconnected");
        try{
          delete player[socket.id];
        } catch (error) {
          // Ignoring the start screen player
        }
        // console.log(player);
    });
});

// Start the server
server.listen(3099, () => {
  console.log('server running at http://localhost:3099');
});