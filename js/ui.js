'use strict';

// --- INTERFACE (DOM) ---
// Único lugar que conversa com o HTML: HUD, inventário, telas, diálogo e carta.
// O visual é todo controlado por classes/atributos; os estilos ficam no style.css.
class UI {
    constructor() {
        const byId = (id) => document.getElementById(id);

        this.hud = byId('hud-score');
        this.levelName = byId('hud-level');
        this.inventoryItems = new Map(
            [...document.querySelectorAll('[data-item]')].map((element) => [element.dataset.item, element])
        );

        this.loading = byId('loading');
        this.controls = byId('touch-controls');

        this.startScreen = byId('screen-start');
        this.startTitle = byId('start-title');
        this.startIntro = byId('start-intro');
        this.startGoalLabel = byId('start-goal-label');
        this.startGoal = byId('start-goal');
        this.startControls = byId('start-controls');

        this.gameOverScreen = byId('screen-gameover');

        this.victoryScreen = byId('screen-victory');
        this.victoryTitle = byId('victory-title');
        this.victoryText = byId('victory-text');

        this.dialog = byId('dialog');
        this.dialogSpeaker = byId('dialog-speaker');
        this.dialogText = byId('dialog-text');

        this.letter = byId('letter');

        this.hudText = null;
    }

    get isTouchDevice() {
        return window.matchMedia('(pointer: coarse)').matches
            || document.documentElement.classList.contains('has-touch');
    }

    // Chamado a cada passo da simulação: só toca no DOM quando o texto realmente muda.
    setHud(text) {
        if (text === this.hudText) return;
        this.hudText = text;
        this.hud.textContent = text;
    }

    // Cada fase tem sua paleta; o CSS lê este atributo.
    setTheme(levelId) {
        document.body.dataset.level = levelId;
    }

    setLevelName(name) {
        this.levelName.textContent = name;
    }

    renderInventory(inventory) {
        this.inventoryItems.forEach((element, type) => {
            element.textContent = `${ITEMS[type].label} (${inventory[type]})`;
            element.classList.toggle('is-collected', inventory[type] > 0);
        });
    }

    setLoading(isLoading) {
        this.loading.hidden = !isLoading;
    }

    setMoveControls(isVisible) {
        this.controls.hidden = !isVisible;
    }

    showStart({ title, intro, goalLabel, goal, controls, touchControls }) {
        this.startTitle.textContent = title;
        this.startIntro.textContent = intro;
        this.startGoalLabel.textContent = goalLabel;
        this.startGoal.textContent = goal;
        UI.setRichText(this.startControls, this.isTouchDevice ? touchControls : controls);
        this.startScreen.hidden = false;
    }

    showGameOver() {
        this.gameOverScreen.hidden = false;
    }

    showVictory({ title, lines }) {
        this.victoryTitle.textContent = title;
        this.victoryText.replaceChildren(...lines.map((line) => {
            const paragraph = document.createElement('p');
            paragraph.textContent = line;
            return paragraph;
        }));
        this.victoryScreen.hidden = false;
    }

    showDialog({ speaker, text }) {
        this.dialogSpeaker.textContent = speaker;
        this.dialog.dataset.speaker = speaker.toLowerCase();
        this.dialogText.textContent = text;
        this.dialog.hidden = false;
    }

    showLetter() {
        this.letter.hidden = false;
        this.letter.scrollTop = 0;
    }

    hideOverlays() {
        [this.startScreen, this.gameOverScreen, this.victoryScreen, this.dialog, this.letter]
            .forEach((element) => { element.hidden = true; });
    }

    // Converte "texto com *destaque*" em nós de texto + <em>, sem usar innerHTML.
    static setRichText(element, text) {
        const nodes = text.split('*').map((part, index) => {
            if (index % 2 === 0) return document.createTextNode(part);
            const emphasis = document.createElement('em');
            emphasis.textContent = part;
            return emphasis;
        });
        element.replaceChildren(...nodes);
    }
}
