'use strict';

// --- INVENTÁRIO SALVO ENTRE AS FASES ---
const InventoryStore = {
    empty() {
        return Object.fromEntries(ITEM_TYPES.map((type) => [type, 0]));
    },

    // Tenta puxar do localStorage; se não houver nada válido, começa zerado.
    load() {
        const inventory = this.empty();
        try {
            const saved = JSON.parse(localStorage.getItem(GAME.storageKey)) || {};
            ITEM_TYPES.forEach((type) => {
                if (Number.isInteger(saved[type]) && saved[type] > 0) inventory[type] = saved[type];
            });
        } catch {
            // Dado corrompido ou armazenamento bloqueado: segue zerado
        }
        return inventory;
    },

    save(inventory) {
        try {
            localStorage.setItem(GAME.storageKey, JSON.stringify(inventory));
        } catch {
            // Sem armazenamento (ex.: aba anônima restrita): o jogo continua, só não persiste
        }
    },

    clear() {
        try {
            localStorage.removeItem(GAME.storageKey);
        } catch {
            // Nada a limpar
        }
    }
};

// --- GERENCIADOR DO JOGO ---
// Controla o estado geral (carregando, jogando, game over...), o loop e a troca de fases.
// A lógica de cada fase fica em js/levels/.
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.context = this.canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;

        this.ui = new UI();
        this.input = new InputHandler({
            surface: this.canvas,
            controls: this.ui.controls,
            onConfirm: () => this.confirm()
        });

        // loading | ready | playing | gameover | complete | cutscene | letter
        this.state = 'loading';
        this.stateSince = 0;

        this.levelIndex = 0;
        this.level = null;
        this.inventory = InventoryStore.empty();
        this.checkpoint = InventoryStore.empty(); // Inventário no início da fase atual

        this.dialogues = [];
        this.dialogIndex = 0;

        this.frameId = null;
        this.lastTime = null;
        this.accumulator = 0;
        this.frame = this.frame.bind(this);

        this.bindEvents();
    }

    bindEvents() {
        const onClick = (id, handler) => document.getElementById(id).addEventListener('click', handler);

        onClick('btn-play', () => this.start());
        onClick('btn-restart', () => this.restart());
        onClick('btn-next', () => this.nextLevel());
        onClick('btn-play-again', () => this.playAgain());
        onClick('dialog', () => this.advanceDialog());

        // Pausa a simulação quando a aba fica em segundo plano
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopLoop();
                this.input.releaseAll();
            } else if (this.state === 'playing') {
                this.startLoop();
            }
        });
    }

    get config() {
        return LEVELS[this.levelIndex];
    }

    get totalGifts() {
        return ITEM_TYPES.reduce((total, type) => total + this.inventory[type], 0);
    }

    setState(state) {
        this.state = state;
        this.stateSince = performance.now();
        this.refreshControls();

        if (state === 'playing') this.startLoop();
        else this.stopLoop();
    }

    // --- TROCA DE FASES ---

    async loadLevel(index) {
        this.levelIndex = index;
        this.level = null;
        this.ui.hideOverlays();
        this.ui.setLoading(true);
        this.setState('loading');
        this.rememberLevel();
        this.ui.setTheme(this.config.id);

        await Assets.load(this.config.assetGroups);

        // A fase 1 sempre começa zerada; as demais herdam o que foi salvo na anterior
        this.checkpoint = index === 0 ? InventoryStore.empty() : InventoryStore.load();
        this.resetLevel();

        this.ui.setLoading(false);
        this.ui.showStart(this.config.start);
        this.setState('ready');
        this.render();

        // Adianta o download da próxima fase enquanto esta é jogada
        const next = LEVELS[index + 1];
        if (next) Assets.load(next.assetGroups);
    }

    // Guarda a fase na URL (#fase2) para que recarregar a página não volte ao início.
    rememberLevel() {
        try {
            history.replaceState(null, '', `#${this.config.id}`);
        } catch {
            // Alguns navegadores bloqueiam isso em file://; não é essencial
        }
    }

    resetLevel() {
        this.inventory = { ...this.checkpoint };
        this.ui.renderInventory(this.inventory);
        this.ui.setLevelName(this.config.name);
        this.ui.setHud(this.config.initialHud);
        this.level = this.config.create(this);
    }

    start() {
        if (this.state !== 'ready') return;
        this.ui.hideOverlays();
        this.setState('playing');
    }

    restart() {
        if (this.state !== 'gameover') return;
        this.resetLevel();
        this.ui.hideOverlays();
        this.setState('playing');
    }

    nextLevel() {
        if (this.state !== 'complete') return;
        InventoryStore.save(this.inventory);
        this.loadLevel(this.levelIndex + 1);
    }

    // Volta para a fase 1 após zerar, com o inventário limpo
    playAgain() {
        if (this.state !== 'letter') return;
        InventoryStore.clear();
        this.loadLevel(0);
    }

    // --- API USADA PELAS FASES ---

    setHud(text) {
        this.ui.setHud(text);
    }

    collect(type) {
        this.inventory[type]++;
        this.ui.renderInventory(this.inventory);
    }

    gameOver() {
        this.setState('gameover');
        this.ui.showGameOver();
    }

    completeLevel(result) {
        this.setState('complete');
        this.ui.showVictory(result);
    }

    startCutscene(dialogues) {
        this.dialogues = dialogues;
        this.dialogIndex = 0;
        this.setState('cutscene');
        this.ui.showDialog(dialogues[0]);
    }

    refreshControls() {
        this.ui.setMoveControls(this.state === 'playing' && this.level.needsMoveControls);
    }

    // --- DIÁLOGO E TECLA DE CONFIRMAÇÃO ---

    advanceDialog() {
        if (this.state !== 'cutscene') return;

        this.dialogIndex++;
        if (this.dialogIndex < this.dialogues.length) {
            this.ui.showDialog(this.dialogues[this.dialogIndex]);
        } else {
            this.ui.hideOverlays();
            this.setState('letter');
            this.ui.showLetter();
        }
    }

    // Espaço/Enter: age conforme a tela aberta.
    confirm() {
        if (this.state === 'ready') {
            this.start();
            return;
        }

        // Evita que um toque de pulo dado no instante da colisão feche a tela sem querer
        if (performance.now() - this.stateSince < GAME.confirmDelay) return;

        if (this.state === 'gameover') this.restart();
        else if (this.state === 'complete') this.nextLevel();
        else if (this.state === 'cutscene') this.advanceDialog();
    }

    // --- LOOP ---

    startLoop() {
        if (this.frameId !== null || document.hidden) return;
        this.lastTime = null;
        this.accumulator = 0;
        this.frameId = requestAnimationFrame(this.frame);
    }

    stopLoop() {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    frame(now) {
        let elapsed = this.lastTime === null ? GAME.step : Math.min(now - this.lastTime, GAME.maxFrameTime);
        // Em telas de ~60 Hz, absorve a variação natural entre quadros (evita 0 ou 2 passos alternados)
        if (Math.abs(elapsed - GAME.step) < 2) elapsed = GAME.step;
        this.lastTime = now;
        this.accumulator += elapsed;

        // Passo fixo: a simulação avança sempre em fatias de 1/60 s, qualquer que seja a taxa da tela
        while (this.accumulator >= GAME.step && this.state === 'playing') {
            this.level.update(GAME.step);
            this.accumulator -= GAME.step;
        }

        this.render();

        // Fora de 'playing' a cena é estática: um último quadro basta, e o loop para de gastar bateria
        this.frameId = this.state === 'playing' ? requestAnimationFrame(this.frame) : null;
    }

    render() {
        this.context.clearRect(0, 0, GAME.width, GAME.height);
        this.level.draw(this.context);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const savedIndex = LEVELS.findIndex((level) => `#${level.id}` === window.location.hash);
    game.loadLevel(Math.max(savedIndex, 0));
});
