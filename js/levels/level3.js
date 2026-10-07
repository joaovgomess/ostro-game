'use strict';

// --- FASE 3: VARSÓVIA (plataforma com câmera estilo Mario) ---

// --- INIMIGOS (ESMAGÁVEIS E BATE-VOLTA) ---
class Enemy extends Entity {
    static SPRITES = ['fase3.npc1', 'fase3.npc2', 'fase3.npc3'];

    constructor() {
        super({
            x: GAME.width + 100, // Nascem fora da tela, à direita
            y: GAME.groundY - 160 + 25,
            width: 160,
            height: 160,
            sprite: randomItem(Enemy.SPRITES),
            hitboxOffset: { x: 50, y: 50, width: -100, height: -70 }
        });

        this.vx = -(Math.random() * 2 + 1);
        this.enteredScreen = false;
    }

    update(cameraShift) {
        // Move de acordo com a própria velocidade E o movimento da câmera
        this.x += this.vx - cameraShift;

        if (!this.enteredScreen && this.x + this.width <= GAME.width) {
            this.enteredScreen = true;
        }

        // "Bate e volta" nas bordas da tela
        if (this.enteredScreen) {
            if (this.x <= 0) {
                this.x = 0;
                this.vx = Math.abs(this.vx);
            } else if (this.x + this.width >= GAME.width) {
                this.x = GAME.width - this.width;
                this.vx = -Math.abs(this.vx);
            }
        }

        if (this.x + this.width < -100 || this.x > GAME.width + 200) {
            this.markedForDeletion = true;
        }
    }
}

class Level3 extends Level {
    static DURATION = 30000;
    static CAMERA_ANCHOR_X = GAME.width * 0.5; // O jogador trava aqui e o cenário passa a andar
    static MIN_PLAYER_X = 50;
    static STOMP_TOLERANCE = 25;
    static STOMP_BOUNCE = -12;

    constructor(game) {
        super(game);

        this.cameraShift = 0;
        this.levelTimer = 0;
        this.enemiesDefeated = 0;

        this.background = new Background([
            ['fase3.sky', 0.2],
            ['fase3.buildings4', 0.4],
            ['fase3.buildings3', 0.6],
            ['fase3.buildings2', 0.8],
            ['fase3.buildings1', 0.9],
            ['fase3.road', 1.0]
        ]);

        this.player = new Runner({
            x: 100,
            speedX: 6,
            gravity: 1.2,
            jumpForce: 18,
            hitboxOffset: { x: 10, y: 5, width: -20, height: -5 }
        });

        this.enemies = [];
        this.enemyTimer = new SpawnTimer(2000, () => Math.random() * 1000 + 1000);
        this.collectibleTimer = new SpawnTimer(3000);

        // Ela só aparece depois de DURATION; o jogador tem que andar até ela
        this.girlfriend = null;
    }

    get needsMoveControls() {
        return true;
    }

    update(deltaTime) {
        const { game, player } = this;

        if (!this.girlfriend) {
            this.levelTimer += deltaTime;

            if (this.levelTimer >= Level3.DURATION) {
                this.girlfriend = new Entity({
                    x: GAME.width + 300,
                    y: GAME.groundY - 120 + 25,
                    width: 120,
                    height: 120,
                    sprite: 'fase3.iza',
                    hitboxOffset: { x: 50, y: 50, width: -100, height: -70 }
                });
                game.setHud('Find Izka!');
            }
        }

        this.updatePlayer(deltaTime);
        this.background.update(this.cameraShift);

        if (!this.girlfriend) this.spawn(deltaTime);

        this.enemies.forEach((enemy) => enemy.update(this.cameraShift));
        this.collectibles.forEach((item) => {
            // Os itens ficam parados no mundo, movendo-se apenas pela câmera
            item.update(this.cameraShift);
            if (item.x + item.width < -100) item.markedForDeletion = true;
        });

        if (!this.resolveEnemyCollisions()) {
            game.gameOver();
            return;
        }

        this.collectTouching(player);

        if (this.girlfriend) {
            this.girlfriend.x -= this.cameraShift;
            if (intersects(player.hitbox, this.girlfriend.hitbox)) {
                game.startCutscene(this.buildDialogues());
            }
        }

        this.enemies = Level.prune(this.enemies);
        this.collectibles = Level.prune(this.collectibles);
    }

    updatePlayer(deltaTime) {
        const { player } = this;
        const { input } = this.game;

        player.vx = 0;
        if (input.right) player.vx = player.speedX;
        else if (input.left) player.vx = -player.speedX;
        player.x += player.vx;

        // Câmera "esteira": ao passar do centro indo para a direita, quem anda é a tela
        this.cameraShift = 0;
        if (player.x > Level3.CAMERA_ANCHOR_X && player.vx > 0) {
            this.cameraShift = player.vx;
            player.x = Level3.CAMERA_ANCHOR_X;
        } else if (player.x < Level3.MIN_PLAYER_X) {
            player.x = Level3.MIN_PLAYER_X;
        }

        player.update(deltaTime, {
            jumpHeld: input.jump,
            groundY: GAME.groundY,
            moving: player.vx !== 0
        });
    }

    spawn(deltaTime) {
        if (this.enemyTimer.tick(deltaTime)) this.enemies.push(new Enemy());

        if (this.collectibleTimer.tick(deltaTime)) {
            this.collectibles.push(new Collectible({
                x: GAME.width + 100,
                y: GAME.groundY - 120 - Math.random() * 50,
                bobAmplitude: 1.5,
                hitboxOffset: { x: 5, y: 5, width: -10, height: -10 }
            }));
        }
    }

    // PULO DO MARIO (STOMP): cair sobre a cabeça derrota o inimigo; bater de lado é game over.
    // Devolve false se o jogador foi atingido.
    resolveEnemyCollisions() {
        const { player } = this;

        for (const enemy of this.enemies) {
            const playerBox = player.hitbox;
            const enemyBox = enemy.hitbox;
            if (!intersects(playerBox, enemyBox)) continue;

            const feetBefore = playerBox.y + playerBox.height - player.vy;
            const isStomp = player.vy > 0 && feetBefore <= enemyBox.y + Level3.STOMP_TOLERANCE;
            if (!isStomp) return false;

            enemy.markedForDeletion = true;
            player.vy = Level3.STOMP_BOUNCE; // "Quique" para cima ao amassar o inimigo
            this.enemiesDefeated++;
            this.game.setHud(`Defeated: ${this.enemiesDefeated}`);
        }

        return true;
    }

    buildDialogues() {
        const { inventory, totalGifts } = this.game;
        const presentText = totalGifts > 0
            ? `you brought me ${inventory.pandora} Pandoras, ${inventory.flowers} Flowers e ${inventory.pirulito} ChupaChups! I love it!`
            : 'You didnt get me anything? Ja pierdole!';

        return [
            { speaker: 'Vitor', text: 'Hey beautiful, how are you doing. I crossed cities and oceans and finally made it to you. Im so glad i made it on time...' },
            { speaker: 'Vitor', text: 'Im here for your birthday and i brought you gifts!' },
            { speaker: 'Izabelka', text: "Hejka Vituś, i can't believe you're really here!" },
            { speaker: 'Izabelka', text: `And ${presentText}` },
            { speaker: 'Vitor', text: "And that's not all, i also brought you a letter! Here it is." }
        ];
    }

    draw(context) {
        this.background.draw(context);

        this.enemies.forEach((enemy) => enemy.draw(context));
        this.collectibles.forEach((item) => item.draw(context));
        if (this.girlfriend) this.girlfriend.draw(context);

        this.player.draw(context);
    }
}
