'use strict';

// --- CONFIGURAÇÃO CENTRAL ---
// Tudo o que é "dado" (tamanhos, caminhos, textos) fica aqui; a lógica fica nos outros arquivos.

const GAME = Object.freeze({
    width: 800,
    height: 400,
    groundY: 320,            // Nível da calçada/rua
    step: 1000 / 60,         // Passo fixo da simulação (ms): a física roda igual em 60 Hz ou 144 Hz
    maxFrameTime: 100,       // Evita "saltos" ao voltar de uma aba em segundo plano
    confirmDelay: 600,       // Tempo mínimo antes de Espaço/Enter confirmar uma tela recém-aberta
    storageKey: 'jornada_inventory'
});

const ITEMS = Object.freeze({
    pandora: { label: '💍 Pandora', sprite: 'geral.ring' },
    flowers: { label: '🌹 Flowers', sprite: 'geral.rose' },
    pirulito: { label: '🍭 ChupaChups', sprite: 'geral.lollipop' }
});

const ITEM_TYPES = Object.freeze(Object.keys(ITEMS));

// chave: [caminho, largura, altura] -> cada imagem é pré-renderizada uma única vez no tamanho em que é desenhada.
// O prefixo da chave é o grupo carregado por fase.
const ASSETS = Object.freeze({
    'geral.idle': ['assets/geral/personagens/vitor-parado.png', 60, 80],
    'geral.run1': ['assets/geral/personagens/vitor-correndo1.png', 60, 80],
    'geral.run2': ['assets/geral/personagens/vitor-correndo2.png', 60, 80],
    'geral.run3': ['assets/geral/personagens/vitor-correndo3.png', 60, 80],
    'geral.ring': ['assets/geral/presentes/ironring.png', 40, 40],
    'geral.rose': ['assets/geral/presentes/rose.png', 40, 40],
    'geral.lollipop': ['assets/geral/presentes/pirulito.png', 40, 40],

    'fase1.sky': ['assets/fase1/background/sky.png', 800, 400],
    'fase1.buildings4': ['assets/fase1/background/buildings4.png', 800, 400],
    'fase1.buildings3': ['assets/fase1/background/buildings3.png', 800, 400],
    'fase1.buildings2': ['assets/fase1/background/buildings2.png', 800, 400],
    'fase1.buildings1': ['assets/fase1/background/buildings1.png', 800, 400],
    'fase1.lights': ['assets/fase1/background/lights.png', 800, 400],
    'fase1.road': ['assets/fase1/background/road-border.png', 800, 400],
    'fase1.airport': ['assets/fase1/background/airport.png', 750, 500],
    'fase1.car': ['assets/fase1/obstaculos/nissan.png', 120, 60],

    'fase2.ocean1': ['assets/fase2/background/ocean-1.png', 800, 400],
    'fase2.ocean2': ['assets/fase2/background/ocean-2.png', 800, 400],
    'fase2.ocean3': ['assets/fase2/background/ocean-3.png', 800, 400],
    'fase2.ocean4': ['assets/fase2/background/ocean-4.png', 800, 400],
    'fase2.flag': ['assets/fase2/background/flag-poland.png', 200, 400],
    'fase2.plane': ['assets/fase2/aviao.png', 100, 100],
    'fase2.cloud': ['assets/fase2/cloud.png', 200, 150],
    'fase2.bird': ['assets/fase2/bird.png', 60, 60],

    'fase3.sky': ['assets/fase3/background/sky.png', 800, 400],
    'fase3.buildings4': ['assets/fase3/background/buildings4.png', 800, 400],
    'fase3.buildings3': ['assets/fase3/background/buildings3.png', 800, 400],
    'fase3.buildings2': ['assets/fase3/background/buildings2.png', 800, 400],
    'fase3.buildings1': ['assets/fase3/background/buildings1.png', 800, 400],
    'fase3.road': ['assets/fase3/background/road-border.png', 800, 400],
    'fase3.npc1': ['assets/fase3/obstaculos/npc-kurwa.png', 160, 160],
    'fase3.npc2': ['assets/fase3/obstaculos/npc-chuj.png', 160, 160],
    'fase3.npc3': ['assets/fase3/obstaculos/npc-pierdole.png', 160, 160],
    'fase3.iza': ['assets/geral/personagens/iza.png', 120, 120]
});

// Nos textos, *asteriscos* marcam um trecho em destaque.
// "create" é uma função para que os arquivos das fases possam ser carregados depois deste.
const LEVELS = Object.freeze([
    {
        id: 'fase1',
        create: (game) => new Level1(game),
        assetGroups: ['geral', 'fase1'],
        name: 'Level 1: São Paulo',
        initialHud: 'Distance: 0m',
        start: {
            title: 'Happy Birthday Pretty Princess!',
            intro: 'Today is your birthday, and Vitor needs your help to deliver your presents. Help him collect the gifts scattered along the way and bring them all the way to you in Poland!',
            goalLabel: 'Level 1:',
            goal: "Survive São Paulo's traffic and reach the airport.",
            controls: 'To control vitor, tap the screen or use the spacebar.',
            touchControls: 'Tap the screen to jump. At the airport, use the ◀ ▶ buttons to walk.'
        }
    },
    {
        id: 'fase2',
        create: (game) => new Level2(game),
        assetGroups: ['geral', 'fase2'],
        name: 'Level 2 - Atlantic Ocean',
        initialHud: 'Distance: 0km',
        start: {
            title: 'Crossing the Ocean',
            intro: 'Vitor has boarded and is almost there! Now you need to help him cross the ocean and reach Poland.',
            goalLabel: 'Level 2:',
            goal: 'Avoid the storm clouds and birds until you cross the border!',
            controls: 'HOLD the screen or the spacebar to gain altitude. Release to go down.',
            touchControls: 'HOLD the screen to gain altitude. Release to go down.'
        }
    },
    {
        id: 'fase3',
        create: (game) => new Level3(game),
        assetGroups: ['geral', 'fase3'],
        name: 'Level 3 - Warszawa',
        initialHud: 'Defeated: 0',
        start: {
            title: 'Find Izabelka',
            intro: 'Vitor has landed! Help him find Izabelka through the city streets and deliver his presents.',
            goalLabel: 'Level 3:',
            goal: "Izunia doesn't like Vitor swearing. So don't let any pole teach him swear words and find Vitor's pretty princess at the end of the street!",
            controls: 'Use the arrow keys to move freely around the map. Press Space or the Up Arrow to jump *on the head* of the poles!',
            touchControls: 'Use the ◀ ▶ buttons to move freely around the map. Tap ▲ or the screen to jump *on the head* of the poles!'
        }
    }
]);
