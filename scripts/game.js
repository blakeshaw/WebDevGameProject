const socket = io();

let keys = {}; //keep track of which keys are pressed
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

const gameArea = document.getElementById("game-area");
const game_area_x = 5000;
const game_area_y = 5000;

let ship = {
    name: localStorage.getItem("player-name"),
    id: null,
    x: Math.random() * game_area_x,
    y: Math.random() * game_area_y,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    health: 3,
    damage: 1,
    score: 0,
    ammo: 0,
    boostLeft: 0,
}
socket.emit('newClient', ship);
socket.on("updateID", socket_id => {
    if(!ship) return;
    ship.id = socket_id;
});
let players = {};
let asteroids = [];
let bullets = [];
let collectables = [];
let leaderboard = {};
let sortedLeaderboard = [];
socket.on("players", (all_players) => {
    players = all_players;
    ship = all_players[socket.id];
    if(!ship) return;

    if (ship.health <= 0) {
        window.location.href = '/';
        socket.emit("makeCollectables", ship.x, ship.y, ship.ammo);
    }
});
socket.on("asteroids", (all_asteroids) => {
    asteroids = all_asteroids;
});
socket.on("bullets", (all_bullets) => {
    bullets = all_bullets;
});
socket.on("collectables", (all_collectables) => {
    collectables = all_collectables;
});

let lastBulletTime = 0;
const bulletCooldown = 200;
function controlPlayer() {
    if (!ship) return;
    if (!ship.id){
        socket.emit("newClient", ship);
        return;
    }

    if (keys["ArrowLeft"] || keys["a"]) ship.angle -= 1.5;
    if (keys["ArrowRight"] || keys["d"]) ship.angle += 1.5;
    if (keys["ArrowUp"] || keys["w"]) {
        if (Math.abs(ship.velocityX) < 3) ship.velocityX += Math.sin(ship.angle * Math.PI / 180) * 0.01;
        if (Math.abs(ship.velocityY) < 3) ship.velocityY += Math.cos(ship.angle * Math.PI / 180) * 0.01;
    } else if (keys["ArrowDown"] || keys["s"]) {
        if (Math.abs(ship.velocityX) < 3) ship.velocityX -= Math.sin(ship.angle * Math.PI / 180) * 0.002;
        if (Math.abs(ship.velocityY) < 3) ship.velocityY -= Math.cos(ship.angle * Math.PI / 180) * 0.002;
    } else {
        ship.velocityX *= 0.993;
        ship.velocityY *= 0.993;
    }
    const currentTime = Date.now();
    if (keys[" "] && currentTime - lastBulletTime > bulletCooldown && ship.ammo > 0) {
        shot = true;
        const bulletVelocityX = ship.velocityX + Math.sin(ship.angle * Math.PI / 180) * 15;
        const bulletVelocityY = ship.velocityY - Math.cos(ship.angle * Math.PI / 180) * 15;
        socket.emit("makeBullet", ship.x + 10, ship.y + 10, bulletVelocityX, bulletVelocityY, ship.damage, socket.id);
        lastBulletTime = currentTime;
        ship.ammo -= 1;
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

function updateHUD() {
    if (!ship) return;
    document.getElementById("health").textContent = `Health: ${ship.health}`;
    document.getElementById("score").textContent = `Score: ${ship.score}`;
    document.getElementById("ammo").textContent = `Ammo: ${ship.ammo}`;

    Object.values(players).forEach(player => {
        if(leaderboard.length < 5){
            if(!leaderboard[player.id]){
                leaderboard[player.id] = player.score;
            }
            var keys = Object.keys(leaderboard);


            for(let i = 0; i < keys.length; i++){
                if(leaderboard[player.id]){}
            }
        }

    });
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

    //Render collectables -- unshot bullets
    collectables.forEach((piece, index) => {
        if (!piece) return;
        if ((piece.x + offsetX >= -100 && piece.x + offsetX <= windowWidth + 100) && (piece.y + offsetY >= -100 && piece.y + offsetY <= windowHeight + 100)) {
            const collectableElement = document.createElement("div");
            collectableElement.classList.add(piece.type);
            collectableElement.style.left = piece.x + "px";
            collectableElement.style.top = piece.y + "px";
            collectableElement.style.width = piece.amount + "px";
            collectableElement.style.height = piece.amount + "px";

            gameArea.appendChild(collectableElement);

            //Handle colisions with player (in a dope af way)
            const a = ship.x - (piece.x + (piece.amount / 2));
            const b = ship.y - (piece.y + (piece.amount / 2));
            const distance = Math.sqrt((a ** 2) + (b ** 2));

            if (distance < 50) {
                piece.x += (ship.x - piece.x) * 0.2;
                piece.y += (ship.y - piece.y) * 0.2;
                socket.emit("updateCollectables", piece, index);
                if (distance < 10) {
                    if(piece.type == "ammo"){
                        ship.ammo += piece.amount;
                        ship.score += piece.amount;
                    }else if(piece.type == "health"){
                        ship.health += piece.amount;
                    }

                    collectables.splice(index, 1);
                    socket.emit("updatePlayer", socket.id, ship);
                    socket.emit("removeCollectable", index);
                }
            }
        }
    });

    //Render ships
    Object.values(players).forEach(player => {
        if (!player) return;
        if ((player.x + offsetX >= -100 && player.x + offsetX <= (windowWidth + 100)) && (player.y + offsetY >= -100 && player.y + offsetY <= (windowHeight + 100))) {
            const playerElement = document.createElement("div");
            playerElement.classList.add("player");
            playerElement.style.left = player.x + "px";
            playerElement.style.top = player.y + "px";
            playerElement.style.transform = `rotate(${player.angle}deg)`;

            gameArea.appendChild(playerElement);

            const playerName = document.createElement("div");
            playerName.classList.add("player-name");
            playerName.textContent = player.name; // Display the player's name (you can set this when they join)
            playerName.style.left = `${player.x}px`;
            playerName.style.top = `${player.y + 30}px`; // Position it below the ship (adjust the value as needed)
            playerName.style.position = "absolute"; // Ensure it's positioned relative to the game area
            playerName.style.color = "white"; // Optional: style the text as needed
            playerName.style.fontSize = "12px"; // Optional: adjust the font size

            gameArea.appendChild(playerName); // Append the name element
        }
    });

    //Render asteroids
    asteroids.forEach((asteroid, index) => {
        if (!asteroid) return;
        if ((asteroid.x + offsetX >= -100 && asteroid.x + offsetX <= windowWidth + 100) && (asteroid.y + offsetY >= -100 && asteroid.y + offsetY <= windowHeight + 100)) {
            const asteroidElement = document.createElement("div");
            asteroidElement.classList.add("asteroid");
            asteroidElement.style.left = asteroid.x + "px";
            asteroidElement.style.top = asteroid.y + "px";
            asteroidElement.style.width = asteroid.size + "px";
            asteroidElement.style.height = asteroid.size + "px";


            gameArea.appendChild(asteroidElement);

            //Handle collisions with player
            const a = ship.x - (asteroid.x + (asteroid.size / 2));
            const b = ship.y - (asteroid.y + (asteroid.size / 2));
            const distance = Math.sqrt((a ** 2) + (b ** 2));

            if (distance < asteroid.size / 2 && asteroid.collisionUpdatesCooldownLeft == 0) { //TODO make ship collision look right here
                const normalX = a / distance; // Normal vector (x-component)
                const normalY = b / distance; // Normal vector (y-component)
                const tangentX = -normalY;
                const tangentY = normalX;
                const mass1 = asteroid.size;
                const mass2 = 100;
                // Project velocities onto the normal and tangent vectors
                const dotProductNormal1 = asteroid.velocityX * normalX + asteroid.velocityY * normalY;
                const dotProductNormal2 = ship.velocityX * normalX + ship.velocityY * normalY;
                const dotProductTangent1 = asteroid.velocityX * tangentX + asteroid.velocityY * tangentY;
                const dotProductTangent2 = ship.velocityX * tangentX + ship.velocityY * tangentY;
                // Use conservation of momentum to calculate new normal velocities
                const newDotProductNormal1 = (dotProductNormal1 * (mass1 - mass2) + 2 * mass2 * dotProductNormal2) / (mass1 + mass2);
                const newDotProductNormal2 = (dotProductNormal2 * (mass2 - mass1) + 2 * mass1 * dotProductNormal1) / (mass1 + mass2);
                // Update velocities
                asteroid.velocityX = tangentX * dotProductTangent1 + normalX * newDotProductNormal1;
                asteroid.velocityY = tangentY * dotProductTangent1 + normalY * newDotProductNormal1;
                ship.velocityX = tangentX * dotProductTangent2 + normalX * newDotProductNormal2;
                ship.velocityY = tangentY * dotProductTangent2 + normalY * newDotProductNormal2;
                // Slightly separate the asteroids to avoid overlap
                const overlap = (asteroid.size / 2) - distance;
                asteroid.x -= normalX * overlap / 2;
                asteroid.y -= normalY * overlap / 2;
                ship.x += normalX * overlap / 2;
                ship.y += normalY * overlap / 2;

                asteroid.health -= 0;
                ship.health -= 0; //TODO

                socket.emit("updatePlayer", socket.id, ship);
                socket.emit("updateAsteroid", asteroid, index);
            }
        }
    });

    //Render bullets -- shot bullets
    bullets.forEach(bullet => {
        if (!bullet) return;
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
    updateHUD();
    render();
    requestAnimationFrame(gameLoop);
}
gameLoop();