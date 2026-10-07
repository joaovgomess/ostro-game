'use strict';

// --- CARREGAMENTO DE IMAGENS ---
// Cada imagem é baixada uma única vez e "assada" em um canvas do tamanho exato em que aparece no jogo.
// Assim o loop só copia pixels 1:1, em vez de redimensionar PNGs de 1024px a cada quadro.
const Assets = (() => {
    const sprites = new Map();
    const pending = new Map();

    function bake(image, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        // Pixel art (imagem menor que o destino) continua nítida; fotos grandes são suavizadas ao reduzir.
        context.imageSmoothingEnabled = image.naturalWidth > width;
        context.imageSmoothingQuality = 'high';
        if (image.naturalWidth > 0) context.drawImage(image, 0, 0, width, height);

        return canvas;
    }

    function loadOne(key) {
        if (pending.has(key)) return pending.get(key);

        const [src, width, height] = ASSETS[key];
        const promise = new Promise((resolve) => {
            const image = new Image();
            const finish = () => {
                sprites.set(key, bake(image, width, height));
                resolve();
            };
            image.onload = finish;
            image.onerror = () => {
                console.warn(`Não foi possível carregar a imagem: ${src}`);
                finish(); // Sprite vazio: o jogo continua jogável
            };
            image.src = src;
        });

        pending.set(key, promise);
        return promise;
    }

    return {
        // Carrega todos os assets cujos prefixos estão em "groups" (ex.: ['geral', 'fase1']).
        load(groups) {
            const keys = Object.keys(ASSETS).filter((key) => groups.includes(key.split('.')[0]));
            return Promise.all(keys.map(loadOne));
        },

        get(key) {
            return sprites.get(key);
        }
    };
})();
