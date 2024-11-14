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
let asteroids = [];
let ammo = [];
let bullets = [];

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
    socket.emit("asteroids", asteroids)

    //When the client connects it sends the client ID which is used to make a new player.
    socket.on('client-id', async(id) => {
      player[socket.id] = {
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: 0,
        velocityY: 0,
        angle: 0,
        health: 3,
        score: 0
      }
      socket.emit("players", player);
      //console.log(player[socket.id]);
    });
    //When the user wants to update their player on the server it sends updatePlayer
    socket.on("updatePlayer", async(id, ship) => {
      player[id] = ship
      //Send back the list of updated players
      socket.emit("players", player);
    });
    socket.on("updateAsteroids", async(all_asteroids) =>{
      asteroids = all_asteroids;
      socket.emit("asteroids", asteroids);
    });
    socket.on("makeBullet", async(bx, by, bvelocityX, bvelocityY) => {
      bullets.push({
        x: bx,
        y: by,
        velocityX: bvelocityX,
        velocityY: bvelocityY,
        updatesLeft: 50,
      });
    });

    //Remove player from list of players when they disconnect.
    socket.on('disconnect', () => {
        console.log("user " + socket.id + " disconnected");
        try{
          delete player[socket.id];
        } catch (error) {
          // Ignoring the start screen players
        }
        // console.log(player);
    });
});

function makeAsteroids(){
  for (let i = 0; i < 100; i++) {
    asteroids.push({
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: (Math.random() - 0.5) * 1.5,
        velocityY: (Math.random() - 0.5) * 1.5,
        size: 50 + (Math.random() * 50),
    });
  }
}
makeAsteroids();

function updateAsteroids() {
  asteroids.forEach(asteroid => {
      asteroid.x += asteroid.velocityX;
      asteroid.y += asteroid.velocityY;

      // Wrap asteroids around the screen if they go off the edges
      if (asteroid.x < 0) asteroid.x = 5000;
      if (asteroid.x > 5000) asteroid.x = 0;
      if (asteroid.y < 0) asteroid.y = 5000;
      if (asteroid.y > 5000) asteroid.y = 0;
  });
  
  // Emit updated asteroid positions to all connected clients
  io.emit('asteroids', asteroids);
}
setInterval(updateAsteroids, 16);

function updateBullets() {
  bullets.forEach(bullet => {
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;
    
    if(bullet.updatesLeft > 0){
      bullet.updatesLeft -= 1;
    }else{
      const index = bullets.indexOf(bullet);
      if(index > -1) bullets.splice(index, 1);
    }
  });
  io.emit('bullets', bullets);
}
setInterval(updateBullets, 16);

function updatePlayers(){
  io.emit('players', player);
}
setInterval(updatePlayers, 16);

// Start the server
server.listen(3099, () => {
  console.log('server running at http://localhost:3099');
});


