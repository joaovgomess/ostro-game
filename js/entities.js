'use strict';

// --- PEÇAS COMPARTILHADAS ENTRE AS FASES ---

// Algoritmo clássico AABB entre duas hitboxes
function intersects(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
}

class Entity {
    constructor({ x = 0, y = 0, width, height, sprite = null, hitboxOffset = null }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.sprite = sprite ? Assets.get(sprite) : null;
        // HITBOX OFFSET: quanto a caixa de colisão é deslocada/encolhida em relação à imagem
        this.hitboxOffset = hitboxOffset || { x: 0, y: 0, width: 0, height: 0 };
        this.markedForDeletion = false;
    }

    get hitbox() {
        return {
            x: this.x + this.hitboxOffset.x,
            y: this.y + this.hitboxOffset.y,
            width: this.width + this.hitboxOffset.width,
            height: this.height + this.hitboxOffset.height
        };
    }

    draw(context) {
        if (this.sprite) context.drawImage(this.sprite, this.x, this.y);
        // MODO DEBUG: descomente para ver a hitbox
        // const box = this.hitbox;
        // context.strokeStyle = 'red';
        // context.strokeRect(box.x, box.y, box.width, box.height);
    }
}

// --- PARALLAX BACKGROUND ---
// layers: [[chaveDoAsset, modificadorDeVelocidade], ...]. O modificador dita a profundidade.
class Background {
    constructor(layers) {
        this.layers = layers.map(([key, speedModifier]) => ({ image: Assets.get(key), speedModifier, x: 0 }));
    }

    update(shift) {
        this.layers.forEach((layer) => {
            // Mantém x em (-largura, 0] para o loop infinito não dar "pulos"
            layer.x = (layer.x - shift * layer.speedModifier) % GAME.width;
            if (layer.x > 0) layer.x -= GAME.width;
        });
    }

    draw(context) {
        this.layers.forEach((layer) => {
            context.drawImage(layer.image, layer.x, 0);
            context.drawImage(layer.image, layer.x + GAME.width, 0);
        });
    }
}

// --- COLETÁVEIS ---
class Collectible extends Entity {
    constructor({ x, y, bobAmplitude, hitboxOffset }) {
        const type = randomItem(ITEM_TYPES);
        super({ x, y, width: 40, height: 40, sprite: ITEMS[type].sprite, hitboxOffset });

        this.type = type;
        this.bobAmplitude = bobAmplitude;
        this.angle = 0;
        this.angleSpeed = Math.random() * 0.1 + 0.05;
    }

    update(shift) {
        this.x -= shift;
        this.y += Math.sin(this.angle) * this.bobAmplitude;
        this.angle += this.angleSpeed;
    }

    draw(context) {
        // Fundo e borda arredondada (efeito bolha) com o sprite por cima
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(this.x, this.y, this.width, this.height, 8);
        context.fill();
        context.stroke();

        super.draw(context);
    }
}

// --- O JOGADOR A PÉ (fases 1 e 3) ---
// Cuida do pulo, da gravidade e da animação. O movimento horizontal é decidido por cada fase.
class Runner extends Entity {
    static FRAME_INTERVAL = 1000 / 10; // 10 trocas de imagem por segundo

    constructor({ x, speedX, gravity, jumpForce, hitboxOffset }) {
        super({ x, y: GAME.groundY - 80, width: 60, height: 80, hitboxOffset });

        this.vx = 0;
        this.vy = 0;
        this.speedX = speedX;
        this.gravity = gravity;
        this.jumpForce = jumpForce;

        this.idleSprite = Assets.get('geral.idle');
        this.runSprites = ['geral.run1', 'geral.run2', 'geral.run3'].map((key) => Assets.get(key));
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.running = false;
    }

    isOnGround(groundY) {
        return this.y >= groundY - this.height;
    }

    // groundY: altura do chão debaixo do jogador neste instante. moving: se a animação de corrida deve tocar.
    update(deltaTime, { jumpHeld, groundY, moving }) {
        if (jumpHeld && this.isOnGround(groundY)) {
            this.vy -= this.jumpForce;
        }

        this.y += this.vy;
        if (!this.isOnGround(groundY)) {
            // Soltar o botão no meio da subida encurta o pulo
            const cutJump = !jumpHeld && this.vy < 0;
            this.vy += cutJump ? this.gravity * 2.5 : this.gravity;
        } else {
            // Quando aterra, zera a velocidade Y e gruda o pé no chão
            this.vy = 0;
            this.y = groundY - this.height;
        }

        this.running = moving && this.isOnGround(groundY);
        if (!this.running) {
            this.currentFrame = 0;
        } else if (this.frameTimer > Runner.FRAME_INTERVAL) {
            this.currentFrame = (this.currentFrame + 1) % this.runSprites.length;
            this.frameTimer = 0;
        } else {
            this.frameTimer += deltaTime;
        }
    }

    get hasFallen() {
        return this.hitbox.y > GAME.height;
    }

    draw(context) {
        const sprite = this.running ? this.runSprites[this.currentFrame] : this.idleSprite;

        // Espelha a imagem se estiver andando para a esquerda
        if (this.vx < 0) {
            context.save();
            context.scale(-1, 1);
            context.drawImage(sprite, -this.x - this.width, this.y);
            context.restore();
        } else {
            context.drawImage(sprite, this.x, this.y);
        }
    }
}

// --- TEMPORIZADOR DE SPAWN ---
// tick() devolve true quando é hora de criar algo; nextInterval sorteia a próxima espera.
class SpawnTimer {
    constructor(interval, nextInterval = () => interval) {
        this.elapsed = 0;
        this.interval = interval;
        this.nextInterval = nextInterval;
    }

    tick(deltaTime) {
        if (this.elapsed > this.interval) {
            this.elapsed = 0;
            this.interval = this.nextInterval();
            return true;
        }
        this.elapsed += deltaTime;
        return false;
    }
}

// --- BASE DAS FASES ---
// Guarda o que toda fase tem (coletáveis e seu temporizador) e define o contrato usado pelo main.js:
// update(deltaTime), draw(context) e needsMoveControls.
class Level {
    constructor(game) {
        this.game = game;
        this.collectibles = [];
        this.collectibleTimer = new SpawnTimer(3000, () => Math.random() * 2000 + 2000);
    }

    // Botões ◀ ▶ na tela (dispositivos de toque)
    get needsMoveControls() {
        return false;
    }

    // Recolhe os presentes encostados no jogador e devolve quantos foram pegos neste passo.
    collectTouching(player) {
        const playerBox = player.hitbox;
        let collected = 0;

        this.collectibles.forEach((item) => {
            if (!item.markedForDeletion && intersects(playerBox, item.hitbox)) {
                item.markedForDeletion = true;
                this.game.collect(item.type);
                collected++;
            }
        });

        return collected;
    }

    static prune(entities) {
        return entities.filter((entity) => !entity.markedForDeletion);
    }
}
