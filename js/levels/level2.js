'use strict';

// --- FASE 2: OCEANO ATLÂNTICO (voo estilo Jetpack Joyride) ---

class Plane extends Entity {
    static GRAVITY = 0.5;         // Força puxando para baixo
    static THRUST = 0.8;          // Força puxando para cima enquanto segura o botão
    static MAX_FALL_SPEED = 7;
    static MAX_FLY_SPEED = -6;
    static CRUISE_SPEED = 3;      // Avanço em direção à bandeira no fim da fase

    constructor() {
        super({
            x: 100,
            y: GAME.height / 2,
            width: 100,
            height: 100,
            sprite: 'fase2.plane',
            hitboxOffset: { x: 20, y: 30, width: -40, height: -60 }
        });
        this.vy = 0;
    }

    fly(thrusting) {
        this.vy += thrusting ? -Plane.THRUST : Plane.GRAVITY;
        this.vy = Math.min(Math.max(this.vy, Plane.MAX_FLY_SPEED), Plane.MAX_FALL_SPEED);
        this.y += this.vy;

        // Bateu no teto: fica preso lá e zera a velocidade para não acumular força
        if (this.y <= 0) {
            this.y = 0;
            this.vy = 0;
        }
    }

    cruise() {
        this.vy = 0;
        this.x += Plane.CRUISE_SPEED;
    }

    get hitOcean() {
        return this.y + this.height >= GAME.height;
    }
}

class FlyingObstacle extends Entity {
    // extraSpeed: velocidade própria, somada à do cenário
    static TYPES = {
        cloud: { width: 200, height: 150, extraSpeed: 0, sprite: 'fase2.cloud', hitboxOffset: { x: 50, y: 50, width: -100, height: -100 } },
        bird: { width: 60, height: 60, extraSpeed: 2, sprite: 'fase2.bird', hitboxOffset: { x: 5, y: 5, width: -10, height: -10 } }
    };

    constructor(type) {
        const { width, height, extraSpeed, sprite, hitboxOffset } = FlyingObstacle.TYPES[type];
        super({
            x: GAME.width,
            y: Math.random() * (GAME.height - height),
            width,
            height,
            sprite,
            hitboxOffset
        });
        this.extraSpeed = extraSpeed;
    }
}

class Level2 extends Level {
    static DURATION = 30000;
    static ARRIVAL_SCROLL = 8; // Velocidade com que tudo foge da tela ao chegar na Polônia

    constructor(game) {
        super(game);

        this.speed = 5;
        this.distance = 0;
        this.levelTimer = 0;

        this.background = new Background([
            ['fase2.ocean1', 0.8],
            ['fase2.ocean2', 0.4],
            ['fase2.ocean3', 0.5],
            ['fase2.ocean4', 0.2]
        ]);

        this.player = new Plane();
        this.obstacles = [];
        this.obstacleTimer = new SpawnTimer(1200, () => Math.random() * 800 + 800);

        // A bandeira funciona como uma faixa de chegada
        this.polandMode = false;
        this.flag = new Entity({
            x: GAME.width,
            y: 70,
            width: 200,
            height: GAME.height,
            sprite: 'fase2.flag',
            hitboxOffset: { x: 50, y: -20, width: -70, height: 0 }
        });
    }

    update(deltaTime) {
        const { game } = this;

        if (!this.polandMode) {
            this.levelTimer += deltaTime;
            this.distance += this.speed * 0.03;

            if (this.levelTimer >= Level2.DURATION) {
                this.polandMode = true;
                this.speed = 0;
                game.setHud('Welcome to Poland!');
            } else {
                game.setHud(`Distance: ${Math.floor(this.distance)}km`);
            }
        }

        if (this.polandMode) {
            this.updateArrival();
        } else {
            this.updateFlight(deltaTime);
        }
    }

    updateFlight(deltaTime) {
        const { game, player } = this;

        this.background.update(this.speed);
        this.speed += 0.001; // Vai acelerando levemente

        player.fly(game.input.jump);
        if (player.hitOcean) {
            game.gameOver();
            return;
        }

        if (this.obstacleTimer.tick(deltaTime)) {
            this.obstacles.push(new FlyingObstacle(Math.random() < 0.6 ? 'cloud' : 'bird'));
        }
        if (this.collectibleTimer.tick(deltaTime)) {
            this.collectibles.push(new Collectible({
                x: GAME.width,
                y: Math.random() * (GAME.height - 100) + 50,
                bobAmplitude: 2 // Oscila mais forte na fase do avião
            }));
        }

        this.obstacles.forEach((obstacle) => { obstacle.x -= this.speed + obstacle.extraSpeed; });
        this.collectibles.forEach((item) => item.update(this.speed));

        const playerBox = player.hitbox;
        if (this.obstacles.some((obstacle) => intersects(playerBox, obstacle.hitbox))) {
            game.gameOver();
            return;
        }

        this.collectTouching(player);
        this.removeOffscreen();
    }

    // Modo finalização: o avião para de subir/descer e vai reto até a bandeira
    updateArrival() {
        const { game, player, flag } = this;

        if (flag.x > GAME.width - flag.width) flag.x -= 3;

        if (intersects(player.hitbox, flag.hitbox)) {
            game.completeLevel({
                title: 'We are in Poland!',
                lines: [
                    'Congratulations, Vitor just crossed the ocean and landed in Poland.',
                    `Total gifts collecteds: ${game.totalGifts}`
                ]
            });
            return;
        }

        player.cruise();

        // Obstáculos e presentes fogem da tela; os presentes ainda podem ser pegos
        [...this.obstacles, ...this.collectibles].forEach((entity) => {
            entity.x -= Level2.ARRIVAL_SCROLL;
        });

        this.collectTouching(player);
        this.removeOffscreen();
    }

    removeOffscreen() {
        const isVisible = (entity) => entity.x + entity.width >= 0;

        this.obstacles = this.obstacles.filter(isVisible);
        this.collectibles = this.collectibles.filter((item) => !item.markedForDeletion && isVisible(item));
    }

    draw(context) {
        this.background.draw(context);
        if (this.polandMode) this.flag.draw(context);

        this.obstacles.forEach((obstacle) => obstacle.draw(context));
        this.collectibles.forEach((item) => item.draw(context));

        this.player.draw(context);
    }
}
