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

app.use(express.static(__dirname));

// global variables
let players = {};
let asteroids = [];
let ammo = [];
let bullets = [];

let width = 5000;
let height = 5000;
let asteroidMass = 0;
let asteroidMassTarget = 15000;

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

    //When the client connects it sends the client ID which is used to make a new player.
    socket.on('client-id', async(id) => {
      players[socket.id] = {
        name: id,
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: 0,
        velocityY: 0,
        angle: 0,
        health: 3,
        damage: 1,
        score: 0,
        ammo: 0,
        boostLeft: 0,
      }
      try{
        delete players[null];
      }catch(error){}
    });

    //When the user wants to update their player on the server it sends updatePlayer
    socket.on("updatePlayer", async(id, ship) => {
      players[id] = ship
    });
    socket.on("updateAsteroid", async(asteroid, index) =>{
      asteroids[index] = asteroid;
    });
    socket.on("updateAmmo", async(piece, index) => {
      ammo[index] = piece;
    });
    socket.on("removeAmmo", async(index) =>{
      ammo.splice(index, 1);
    });
    socket.on("makeBullet", async(bx, by, bvelocityX, bvelocityY, bdamage, bid) => {
      bullets.push({
        x: bx,
        y: by,
        velocityX: bvelocityX,
        velocityY: bvelocityY,
        updatesLeft: 50,
        damage: bdamage,
        id: bid,
      });
    });

    //Remove player from list of players when they disconnect.
    socket.on('disconnect', () => {
        console.log("user " + socket.id + " disconnected");
        try{
          delete players[socket.id];
        } catch (error) {
          // Ignoring the start screen players
        }
    });
});

function makeAmmo(){
  while(ammo.length < 1000){
    ammo.push({
      x: Math.random() * width,
      y: Math.random() * height,
      amount: 1 + Math.round(Math.random() * 2),
    });
  }
  io.emit("ammo", ammo);
}
setInterval(makeAmmo, 512);

function makeAsteroids(){
  while(asteroidMass < asteroidMassTarget){
    const size = 25 + (Math.random() * 200)
    const health = 1 + (Math.random() * (size / 20));
    const speedMultiplier = 4 - ((size / 100) * 2);
    asteroids.push({
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: (Math.random() - 0.5) * speedMultiplier,
        velocityY: (Math.random() - 0.5) * speedMultiplier,
        size: size,
        health: health,
    });
    asteroidMass += size;
  }
}
makeAsteroids();

function updateAsteroids() {
  asteroids.forEach((asteroid, asteroidIndex) => {
      asteroid.x += asteroid.velocityX;
      asteroid.y += asteroid.velocityY;

      // Wrap asteroids around the screen if they go off the edges
      if (asteroid.x < 0) asteroid.x = 5000;
      if (asteroid.x > 5000) asteroid.x = 0;
      if (asteroid.y < 0) asteroid.y = 5000;
      if (asteroid.y > 5000) asteroid.y = 0;

      //Handle an asteroid dying.
      if(asteroid.health <= 0 && asteroid.size <= 50){
        //Make it drop things
        ammo.push({
          x: asteroid.x + (asteroid.size / 2),
          y: asteroid.y + (asteroid.size / 2),
          amount: 10 + Math.round(Math.random() * 10),
        });
        //Delete the asteroid
        asteroidMass -= asteroid.size;
        asteroids.splice(asteroidIndex, 1);
        if(asteroidMass < asteroidMassTarget){
          makeAsteroids();
        }
      }else if(asteroid.health <= 0){
        //Split the asteroid if it is bigger than 50
        const numSplits = 1 + Math.round(Math.random() * 2);
        let sizeLeft = asteroid.size;
        let healthLeft = Math.random() * (asteroid.size / 20);
        for(let i = 0; i < numSplits; i ++){
          let newSize = 25 + (Math.random() * sizeLeft / 2);
          let newHealth = Math.max(1, (newSize / sizeLeft) * healthLeft);
          const speedMultiplier = 4 - ((newSize / 100) * 2);
          asteroids.push({
            x: asteroid.x,
            y: asteroid.y,
            velocityX: (Math.random() - 0.5) * speedMultiplier,
            velocityY: (Math.random() - 0.5) * speedMultiplier,
            size: newSize,
            health: newHealth,
          });
          sizeLeft -= newSize * 0.5;
          healthLeft -= newHealth;
          asteroidMass += newSize;
        }
        asteroidMass -= asteroid.size;
        asteroids.splice(asteroidIndex, 1);
      }
  });
  
  // Emit updated asteroid positions to all connected clients
  io.emit('asteroids', asteroids);
}
setInterval(updateAsteroids, 64);

function updateBullets() {
  bullets.forEach(bullet => {
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;

    //Handle bullet collisions with asteroids
    asteroids.forEach(asteroid => {
      const a = bullet.x - (asteroid.x + (asteroid.size / 2));
      const b = bullet.y - (asteroid.y + (asteroid.size / 2));
      const distance = Math.sqrt((a ** 2) + (b ** 2));

      if(distance < asteroid.size / 2){
        asteroid.health -= bullet.damage;
        bullet.updatesLeft = 0;

        //Increase player score for killing an asteroid
        if(asteroid.health <= 0){
          players[bullet.id].score += Math.round(asteroid.size / 2);
        }
      }
    });
    //Handle bullet collisions with players
    Object.values(players).forEach(player => {
      const a = bullet.x - (player.x + 10);
      const b = bullet.y - (player.y + 10);
      const distance = Math.sqrt((a ** 2) + (b ** 2));

      if(distance < 20){
        player.health -= bullet.damage;
      }
    });

    //Update the bullets or remove the bullets if they expired.
    if(bullet.updatesLeft > 0){
      bullet.updatesLeft -= 1;
    }else{
      const index = bullets.indexOf(bullet);
      if(index > -1) bullets.splice(index, 1);
      return;
    }
  });
  io.emit('bullets', bullets);
}
setInterval(updateBullets, 16);

function updatePlayers(){
  io.emit('players', players);
}
setInterval(updatePlayers, 32);

// Start the server
server.listen(3099, () => {
  console.log('server running at http://localhost:3099');
});