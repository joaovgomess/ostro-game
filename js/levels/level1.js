'use strict';

// --- FASE 1: SÃO PAULO (corrida automática até o aeroporto) ---

class Car extends Entity {
    constructor() {
        super({
            x: GAME.width,
            y: GAME.groundY - 60,
            width: 120,
            height: 60,
            sprite: 'fase1.car',
            // A imagem é 120x60, mas o asfalto "engole" um pouco as rodas
            hitboxOffset: { x: 10, y: 15, width: -20, height: -15 }
        });
        this.vy = 0;
    }

    update(scrollSpeed, groundY) {
        this.x -= scrollSpeed + 2;

        // Cai se estiver em cima de um buraco
        this.y += this.vy;
        if (this.y < groundY - this.height) {
            this.vy += 1.2;
        } else {
            this.vy = 0;
            this.y = groundY - this.height;
        }
    }
}

class Hole extends Entity {
    constructor() {
        super({ x: GAME.width, y: GAME.groundY, width: 150, height: 20 });
    }

    // Uma entidade está "em cima" do buraco quando o centro da hitbox dela passa da borda
    isUnder(entity) {
        const box = entity.hitbox;
        const centerX = box.x + box.width / 2;
        return centerX > this.x + 10 && centerX < this.x + this.width - 10;
    }

    draw(context) {
        context.fillStyle = '#000';
        context.fillRect(this.x, GAME.groundY, this.width, GAME.height - GAME.groundY);
    }
}

class Level1 extends Level {
    static DURATION = 30000;
    static AIRPORT_SCROLL = 5;      // Velocidade com que o cenário "sai" ao chegar no aeroporto
    static AIRPORT_STOP_X = 250;    // Onde o aeroporto estaciona
    static FALL_GROUND = GAME.height + 200;

    constructor(game) {
        super(game);

        this.speed = 5;
        this.score = 0;
        this.levelTimer = 0;

        this.background = new Background([
            ['fase1.sky', 0.2],
            ['fase1.buildings4', 0.4],
            ['fase1.buildings3', 0.6],
            ['fase1.buildings2', 0.8],
            ['fase1.buildings1', 1.0],
            ['fase1.lights', 1.0],
            ['fase1.road', 1.0]
        ]);

        this.player = new Runner({
            x: 50,
            speedX: 5,
            gravity: 1,
            jumpForce: 20,
            hitboxOffset: { x: 10, y: 10, width: -20, height: -10 }
        });

        this.cars = [];
        this.holes = [];
        this.obstacleTimer = new SpawnTimer(1500, () => Math.random() * 1000 + 1000);

        this.airportMode = false;
        this.airport = new Entity({ x: GAME.width, y: GAME.groundY - 350, width: 750, height: 500, sprite: 'fase1.airport' });
        this.airport.hitboxOffset = { x: 100, y: -120, width: -100, height: 0 };
    }

    get needsMoveControls() {
        return this.airportMode;
    }

    groundUnder(entity) {
        return this.holes.some((hole) => hole.isUnder(entity)) ? Level1.FALL_GROUND : GAME.groundY;
    }

    update(deltaTime) {
        const { game, player } = this;

        if (!this.airportMode) {
            this.levelTimer += deltaTime;

            if (this.levelTimer >= Level1.DURATION) {
                this.airportMode = true;
                this.speed = 0;
                game.setHud('Go to departures!');
                game.refreshControls();
            } else {
                game.setHud(`Distance: ${Math.floor(this.score)}m`);
            }
        }

        if (this.airportMode) {
            if (this.airport.x > Level1.AIRPORT_STOP_X) this.airport.x -= 3;

            if (intersects(player.hitbox, this.airport.hitbox)) {
                game.completeLevel({
                    title: "São Paulo's Airport!",
                    lines: [
                        "Vitor survived de São Paulo's traffic and finally arrived at the airport!",
                        `Total Gifts Collected: ${game.totalGifts}`
                    ]
                });
                return;
            }
        } else {
            this.background.update(this.speed);
            this.speed += 0.001;
            this.score += this.speed * 0.1;
        }

        this.updatePlayer(deltaTime);
        if (player.hasFallen) {
            game.gameOver();
            return;
        }

        if (this.airportMode) {
            this.clearScenery();
        } else {
            this.spawn(deltaTime);
            this.holes.forEach((hole) => { hole.x -= this.speed; });
            this.cars.forEach((car) => car.update(this.speed, this.groundUnder(car)));
            this.collectibles.forEach((item) => item.update(this.speed));
        }

        const playerBox = player.hitbox;
        if (this.cars.some((car) => intersects(playerBox, car.hitbox))) {
            game.gameOver();
            return;
        }

        this.score += 50 * this.collectTouching(player);
        this.removeOffscreen();
    }

    updatePlayer(deltaTime) {
        const { player } = this;
        const { input } = this.game;
        const groundY = this.groundUnder(player);

        // Modo Aeroporto: o cenário para e o jogador anda livremente
        player.vx = 0;
        if (this.airportMode) {
            if (input.right) player.vx = player.speedX;
            else if (input.left) player.vx = -player.speedX;

            player.x = Math.min(Math.max(player.x + player.vx, 0), GAME.width - player.width);
        }

        player.update(deltaTime, {
            jumpHeld: input.jump,
            groundY,
            moving: player.vx !== 0 || !this.airportMode
        });
    }

    spawn(deltaTime) {
        if (this.obstacleTimer.tick(deltaTime)) {
            if (Math.random() < 0.7) this.cars.push(new Car());
            else this.holes.push(new Hole());
        }

        if (this.collectibleTimer.tick(deltaTime)) {
            this.collectibles.push(new Collectible({
                x: GAME.width,
                y: GAME.groundY - 150 - Math.random() * 50,
                bobAmplitude: 1,
                hitboxOffset: { x: 5, y: 5, width: -10, height: -10 }
            }));
        }
    }

    // No aeroporto, o que sobrou na tela desliza para fora
    clearScenery() {
        [...this.cars, ...this.holes, ...this.collectibles].forEach((entity) => {
            entity.x -= Level1.AIRPORT_SCROLL;
        });
    }

    removeOffscreen() {
        const isGone = (entity) => entity.x + entity.width < 0 || entity.y > GAME.height + 100;

        this.cars = this.cars.filter((car) => !isGone(car));
        this.holes = this.holes.filter((hole) => !isGone(hole));
        this.collectibles = this.collectibles.filter((item) => !item.markedForDeletion && !isGone(item));
    }

    draw(context) {
        this.background.draw(context);
        if (this.airportMode) this.airport.draw(context);

        this.holes.forEach((hole) => hole.draw(context));
        this.cars.forEach((car) => car.draw(context));
        this.collectibles.forEach((item) => item.draw(context));

        this.player.draw(context);
    }
}
