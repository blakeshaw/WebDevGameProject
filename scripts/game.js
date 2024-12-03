const socket = io();

let keys = {}; //keep track of which keys are pressed
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

//Disconnect user if they switch tabs since movement is handled client side it freezes the player if they make the window "hidden"
document.addEventListener("visibilitychange", () => {
    if(document.hidden){
        window.location.href = "/html/index.html";
    }
})

const gameArea = document.getElementById("game-area");
const game_area_x = 5000;
const game_area_y = 5000;

let ship = { //Initialize a new ship for the player
    name: localStorage.getItem("player-name"),
    id: null,
    color: localStorage.getItem("color-player"),
    x: Math.random() * game_area_x,
    y: Math.random() * game_area_y,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    size: null,
    health: 5,
    damage: 1,
    score: 0,
    ammo: 0,
    boostLeft: 0,
}

socket.emit('newClient', ship); //Tell the server about the new player
socket.on("updateID", socket_id => { //Server sends the ID for the ship
    if (!ship) return;
    ship.id = socket_id;
});
let players = {};
let asteroids = [];
let bullets = [];
let collectables = [];
let leaderboard = {};
let sortedLeaderboard = [];
socket.on("players", (all_players) => { //Server sends updated list of players (locations, scores, etc.)
    players = all_players;
    //ship = all_players[socket.id];
    if (!ship) return;

    if (ship.health <= 0) { //if the player has died
        window.location.href = '/';
        socket.emit("makeCollectables", ship.x, ship.y, ship.ammo);
    }
});
socket.on("asteroids", (all_asteroids) => { // Server sends updated asteroids
    asteroids = all_asteroids;
});
socket.on("bullets", (all_bullets) => { //Server sends updated bullets
    bullets = all_bullets;
});
socket.on("collectables", (all_collectables) => { //Server sends update collectables
    collectables = all_collectables;
});
socket.on("playerShot", (damage) => {
    ship.health -= damage;
});

let lastBulletTime = 0;
const bulletCooldown = 200;
function controlPlayer() {
    players[socket.id] = ship;

    if (!ship) return;
    if (!ship.id) {
        socket.emit("newClient", ship);
        return;
    }
    ship.size = 20 + (ship.health * 2);

    if (keys["ArrowLeft"] || keys["a"]) ship.angle -= 2.75;
    if (keys["ArrowRight"] || keys["d"]) ship.angle += 2.75;
    if (keys["ArrowUp"] || keys["w"]) {
        if (Math.abs(ship.velocityX) < 7) ship.velocityX += Math.sin(ship.angle * Math.PI / 180) * 0.05;
        if (Math.abs(ship.velocityY) < 7) ship.velocityY += Math.cos(ship.angle * Math.PI / 180) * 0.05;
    } else if (keys["ArrowDown"] || keys["s"]) {
        if (Math.abs(ship.velocityX) < 7) ship.velocityX -= Math.sin(ship.angle * Math.PI / 180) * 0.002;
        if (Math.abs(ship.velocityY) < 7) ship.velocityY -= Math.cos(ship.angle * Math.PI / 180) * 0.002;
    } else {
        ship.velocityX *= 0.993;
        ship.velocityY *= 0.993;
    }
    const currentTime = Date.now();
    if (keys[" "] && currentTime - lastBulletTime > bulletCooldown && ship.ammo > 0) { //Shoot a bullet
        shot = true;
        const gunshotSound = new Audio('../assets/cochise-type-space-gun-sfx.wav')
        gunshotSound.currentTime = 0
        gunshotSound.play

        const bulletVelocityX = ship.velocityX + Math.sin(ship.angle * Math.PI / 180) * 15; //Find velocities based on current angle/speed
        const bulletVelocityY = ship.velocityY - Math.cos(ship.angle * Math.PI / 180) * 15;
        socket.emit("makeBullet", ship.x + (ship.size / 2), ship.y + (ship.size / 2), bulletVelocityX, bulletVelocityY, ship.damage, socket.id); //Tell the server to make a bullet
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

    socket.emit("updatePlayer", socket.id, ship); //Tell the server any changes to the player
}

function updateHUD() { //Updates personal hud as well as the leaderboard
    if (!ship) return;
    document.getElementById("health").textContent = `Health: ${ship.health}`;
    document.getElementById("score").textContent = `Score: ${ship.score}`;
    document.getElementById("ammo").textContent = `Ammo: ${ship.ammo}`;

    const playerArray = Object.values(players);
    playerArray.sort((a, b) => b.score - a.score);
    const topPlayers = playerArray.splice(0, 5);
    const leaderboardContainer = document.getElementById("leaderboard");
    leaderboardContainer.innerHTML = "";

    topPlayers.forEach((player, index) => {
        const playerElement = document.createElement("div");
        playerElement.textContent = `${index + 1}. ${player.name}: ${player.score}`;
        leaderboardContainer.appendChild(playerElement);
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

    //Render collectables
    // TODO: When there is more than one player the collectables count increases by some crazy amount
    // Fix this
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
            const a = (ship.x + (ship.size / 2)) - (piece.x + (piece.amount / 2));
            const b = (ship.y + (ship.size / 2)) - (piece.y + (piece.amount / 2));
            const distance = Math.sqrt((a ** 2) + (b ** 2));
            socket.emit("updateCollectables", piece, index);

            if (distance < ship.size * 1.5) {
                piece.x += ((ship.x + (ship.size / 2)) - piece.x) * 0.2;
                piece.y += ((ship.y + (ship.size / 2)) - piece.y) * 0.2;
                if (distance < ship.size / 3) {
                    if (piece.type == "ammo") {
                        ship.ammo += piece.amount;
                        ship.score += piece.amount;
                    } else if (piece.type == "health") {
                        ship.health += piece.amount;
                    }

                    collectables.splice(index, 1);
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
            playerElement.style.left = (player.x) + "px";
            playerElement.style.top = (player.y) + "px";
            playerElement.style.borderWidth = `0 ${player.size / 2}px ${player.size}px ${player.size / 2}px`;
            playerElement.style.transform = `rotate(${player.angle}deg)`;
            playerElement.style.borderColor = `transparent transparent ${player.color} transparent`;

            const flameElement = document.createElement("div");
            flameElement.classList.add("flame");

            // Calculate flame size based on velocity
            const velocityMagnitude = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2);
            const maxFlameHeight = player.size * 1.5; // Maximum flame length (adjust as needed)
            const flameHeight = Math.min(maxFlameHeight, velocityMagnitude * 10); // Scale velocity for effect

            flameElement.style.position = "absolute";
            flameElement.style.bottom = `${-flameHeight - player.size}px`; // Position below the triangle
            flameElement.style.left = "50%";
            flameElement.style.transform = "translateX(-50%)";
            flameElement.style.width = "0";
            flameElement.style.height = "0";
            flameElement.style.borderStyle = "solid";
            flameElement.style.borderWidth = `${flameHeight}px ${player.size / 4}px 0 ${player.size / 4}px`;
            flameElement.style.borderColor = `orange transparent transparent transparent`;

            // Add the flame to the player element
            playerElement.appendChild(flameElement);

            gameArea.appendChild(playerElement);

            const playerName = document.createElement("div");
            playerName.classList.add("player-name");
            playerName.textContent = player.name; // Display the player's name (you can set this when they join)
            playerName.style.left = `${player.x + (player.size / 2)}px`;
            playerName.style.top = `${player.y + (player.size / 2) + 50}px`; // Position it below the ship (adjust the value as needed)
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
            asteroidElement.style.clipPath = `polygon(${asteroid.shape.map(p => `${50 + p[0]}% ${50 + p[1]}%`).join(", ")})`;
            asteroidElement.style.transform = `rotate(${asteroid.angle}deg)`;

            gameArea.appendChild(asteroidElement);

            //Handle collisions with player
            const a = (ship.x + (ship.size / 2)) - (asteroid.x + (asteroid.size / 2));
            const b = (ship.y + (ship.size / 2)) - (asteroid.y + (asteroid.size / 2));
            const distance = Math.sqrt((a ** 2) + (b ** 2));

            if ((distance - (ship.size / 2)) < asteroid.size / 2) { //TODO something is weird with managing healths
                ship.velocityX = (-1 * ship.velocityX) + asteroid.velocityX;
                ship.velocityY = (-1 * ship.velocityY) + asteroid.velocityY;

                const magnitude = Math.sqrt((ship.x - asteroid.x) ** 2 + (ship.y - asteroid.y) ** 2);
                const overlap = (asteroid.size / 2) - distance;
                ship.x += ((ship.x - asteroid.x) / magnitude) * overlap;
                ship.y += ((ship.y - asteroid.y) / magnitude) * overlap;

                ship.health -= 1;
                asteroid.health -= 2;
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

//Make game logic happen at the same rate for (most) computers for consistent game play across clients:
let lastTime = 0;
const fixedTimeStep = 1000 / 60; //The 60 is for 60 fps --> Rendering will happen as fast as possible though
let accumulatedTime = 0;

function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = Math.min(currentTime - lastTime, 1000);
    lastTime = currentTime

    accumulatedTime += deltaTime;

    //Make things in while loop only happen every xFPS
    while(accumulatedTime >= fixedTimeStep) {
        controlPlayer();
        updateHUD();
        accumulatedTime -= fixedTimeStep;
    }
    //Have the things happen out of while loop as much as possible.
    render();
    requestAnimationFrame(gameLoop);
}
gameLoop();