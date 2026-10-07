'use strict';

// --- CONFIGURAÇÃO DE INPUTS ---
// Um único gerenciador para teclado, toque e mouse. É criado uma vez e reaproveitado em todas as fases,
// então os listeners nunca se acumulam ao reiniciar.
class InputHandler {
    static KEY_ACTIONS = { Space: 'jump', ArrowUp: 'jump', ArrowLeft: 'left', ArrowRight: 'right' };
    static CONFIRM_KEYS = ['Space', 'Enter'];

    constructor({ surface, controls, onConfirm }) {
        // ação -> conjunto de "fontes" (tecla ou dedo) que a mantêm pressionada
        this.held = { jump: new Set(), left: new Set(), right: new Set() };
        this.onConfirm = onConfirm;

        window.addEventListener('keydown', (event) => this.handleKeyDown(event));
        window.addEventListener('keyup', (event) => this.release(event.code));
        window.addEventListener('blur', () => this.releaseAll());

        // Tocar/clicar na área do jogo = pular (ou voar, na fase 2)
        surface.addEventListener('pointerdown', (event) => this.handlePointerDown(event, 'jump'));
        surface.addEventListener('contextmenu', (event) => event.preventDefault());

        controls.querySelectorAll('[data-action]').forEach((button) => {
            button.addEventListener('pointerdown', (event) => this.handlePointerDown(event, button.dataset.action));
            button.addEventListener('contextmenu', (event) => event.preventDefault());
        });

        window.addEventListener('pointerup', (event) => this.release(`pointer-${event.pointerId}`));
        window.addEventListener('pointercancel', (event) => this.release(`pointer-${event.pointerId}`));
    }

    get jump() { return this.held.jump.size > 0; }
    get left() { return this.held.left.size > 0; }
    get right() { return this.held.right.size > 0; }

    handleKeyDown(event) {
        const onButton = event.target instanceof HTMLButtonElement;
        const action = InputHandler.KEY_ACTIONS[event.code];

        if (action) {
            // Impede a página de rolar com Espaço/setas, sem atrapalhar um botão em foco
            if (!onButton) event.preventDefault();
            this.held[action].add(event.code);
        }

        // event.repeat: segurar a tecla não conta; é preciso soltar e apertar de novo
        if (InputHandler.CONFIRM_KEYS.includes(event.code) && !event.repeat && !onButton) {
            this.onConfirm();
        }
    }

    handlePointerDown(event, action) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        if (event.pointerType === 'touch') document.documentElement.classList.add('has-touch');
        this.held[action].add(`pointer-${event.pointerId}`);
    }

    release(source) {
        Object.values(this.held).forEach((sources) => sources.delete(source));
    }

    releaseAll() {
        Object.values(this.held).forEach((sources) => sources.clear());
    }
}
