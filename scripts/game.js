const socket = io();
socket.emit('client-id', socket.id);

let keys = {}; //keep track of which keys are pressed
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

const gameArea = document.getElementById("game-area");
const game_area_x = 5000;
const game_area_y = 5000;

let ship = {
    x: Math.random() * 5000,
    y: Math.random() * 5000,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    health: 3,
    damage: 1,
    score: 0,
    ammo: 0,
    boostLeft: 0,
}
let players = {};
let asteroids = [];
let bullets = [];
let ammo = [];
socket.on("players", (all_players) => {
    players = all_players;
    ship = all_players[socket.id];
});
socket.on("asteroids", (all_asteroids) => {
    asteroids = all_asteroids;
});
socket.on("bullets", (all_bullets) => {
    bullets = all_bullets;
});
socket.on("ammo", (all_ammo) => {
    ammo = all_ammo;
});

let lastBulletTime = 0;
const bulletCooldown = 200;
function controlPlayer() {
    if (!ship) return;

    if (keys["ArrowLeft"]) ship.angle -= 1.5;
    if (keys["ArrowRight"]) ship.angle += 1.5;
    if (keys["ArrowUp"]) {
        if (Math.abs(ship.velocityX) < 3) ship.velocityX += Math.sin(ship.angle * Math.PI / 180) * 0.01;
        if (Math.abs(ship.velocityY) < 3) ship.velocityY += Math.cos(ship.angle * Math.PI / 180) * 0.01;
    } else {
        ship.velocityX *= 0.993;
        ship.velocityY *= 0.993;
    }
    const currentTime = Date.now();
    if (keys[" "] && currentTime - lastBulletTime > bulletCooldown) {
        shot = true;
        const bulletVelocityX = ship.velocityX + Math.sin(ship.angle * Math.PI / 180) * 10;
        const bulletVelocityY = ship.velocityY - Math.cos(ship.angle * Math.PI / 180) * 10;
        socket.emit("makeBullet", ship.x + 10, ship.y + 10, bulletVelocityX, bulletVelocityY, ship.damage, socket.id);
        lastBulletTime = currentTime;
    }
    //Move the ship
    ship.x += ship.velocityX;
    ship.y -= ship.velocityY;

    if (ship.x < 0) {
        ship.x = 0;
        ship.velocityX = 0;
    }
    if (ship.x > game_area_x) {
        ship.x = game_area_x;
        ship.velocityX = 0;
    }
    if (ship.y < 0) {
        ship.y = 0;
        ship.velocityY = 0;
    }
    if (ship.y > game_area_y) {
        ship.y = game_area_y;
        ship.velocityY = 0;
    }

    socket.emit("updatePlayer", socket.id, ship);
}

function render() {
    if (!ship) return;
    //Clear previous render
    gameArea.innerHTML = "";

    const windowWidth = document.getElementById("viewport").offsetWidth;
    const windowHeight = document.getElementById("viewport").offsetHeight;
    const offsetX = (windowWidth / 2) - ship.x;
    const offsetY = (windowHeight / 2) - ship.y;

    //Render the border
    gameArea.style.left = offsetX + "px";
    gameArea.style.top = offsetY + "px"

    //Render ammo -- unshot bullets
    ammo.forEach(piece => {
        if((piece.x + offsetX >= -100 && piece.x + offsetX <= windowWidth + 100) && (piece.y + offsetY >= -100 && piece.y + offsetY <= windowHeight + 100)) {
            const ammoElement = document.createElement("div");
            ammoElement.classList.add("ammo");
            ammoElement.style.left = piece.x + "px";
            ammoElement.style.top = piece.y + "px";
            ammoElement.style.width = piece.amount + "px";
            ammoElement.style.height = piece.amount + "px";
            
            gameArea.appendChild(ammoElement);
        }
    });

    //Render ships
    Object.values(players).forEach(player => {
        if ((player.x + offsetX >= -100 && player.x + offsetX <= (windowWidth + 100)) && (player.y + offsetY >= -100 && player.y + offsetY <= (windowHeight + 100))) {
            const playerElement = document.createElement("div");
            playerElement.classList.add("player");
            playerElement.style.left = player.x + "px";
            playerElement.style.top = player.y + "px";
            playerElement.style.transform = `rotate(${player.angle}deg)`;
            
            gameArea.appendChild(playerElement);
        }
    });

    //Render asteroids
    asteroids.forEach(asteroid => {
        if ((asteroid.x + offsetX >= -100 && asteroid.x + offsetX <= windowWidth + 100) && (asteroid.y + offsetY >= -100 && asteroid.y + offsetY <= windowHeight + 100)) {
            const asteroidElement = document.createElement("div");
            asteroidElement.classList.add("asteroid");
            asteroidElement.style.left = asteroid.x + "px";
            asteroidElement.style.top = asteroid.y + "px";
            asteroidElement.style.width = asteroid.size + "px";
            asteroidElement.style.height = asteroid.size + "px";
            
            gameArea.appendChild(asteroidElement);
        }
    });

    //Render bullets -- shot bullets
    bullets.forEach(bullet => {
        if ((bullet.x + offsetX >= -100 && bullet.x + offsetX <= windowWidth + 100) && (bullet.y + offsetY >= -100 && bullet.y + offsetY <= windowHeight + 100)) {
            const bulletElement = document.createElement("div");
            bulletElement.classList.add("bullet");
            bulletElement.style.left = bullet.x + "px";
            bulletElement.style.top = bullet.y + "px";

            gameArea.appendChild(bulletElement);
        }
    })
}

function gameLoop() {
    controlPlayer();
    render();
    requestAnimationFrame(gameLoop);
}
gameLoop();