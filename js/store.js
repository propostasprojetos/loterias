// ==========================================
// store.js - Global App State
// ==========================================

export const API_URL = 'https://lotofacil-api-production.up.railway.app';

// ID da Extensão LotoSmart Worker (para comunicação via chrome.runtime.sendMessage)
export const EXTENSION_ID = 'eddeaonolckbobhneoegfbjpoggikkmk';

// ===== ESTADO GLOBAL =====
export const state = {
    currentSession: null,
    currentProfile: null,
    generationMode: 'conservative',
    activeGames: [
        {
            name: 'Lotofácil',
            slug: 'lotofacil',
            totalNumbers: 25,
            selectRange: { min: 15, max: 20 },
            parametros: { cost: 3.00, enabled: true }
        },
        {
            name: 'Quina',
            slug: 'quina',
            totalNumbers: 80,
            selectRange: { min: 5, max: 15 },
            parametros: { cost: 2.50, enabled: true }
        }
    ],
    currentGamesData: {} // Will be populated dynamically
};

export const MODES = {
    conservative: {
        label: 'Conservador',
        lf: { maxIntersect: 10, baseOverlapMin: 9, baseOverlapMax: 11, candidateMultiplier: 4, weightCoverage: 12, weightOverlap: 15 },
        qn: { minGap: 12, maxIntersect: 2, candidateMultiplier: 4, weightCoverage: 12, weightDispersion: 3, weightOverlap: 20 }
    },
    balanced: {
        label: 'Balanceado',
        lf: { maxIntersect: 9, baseOverlapMin: 8, baseOverlapMax: 11, candidateMultiplier: 6, weightCoverage: 15, weightOverlap: 25 },
        qn: { minGap: 15, maxIntersect: 2, candidateMultiplier: 6, weightCoverage: 15, weightDispersion: 6, weightOverlap: 30 }
    },
    aggressive: {
        label: 'Agressivo',
        lf: { maxIntersect: 8, baseOverlapMin: 7, baseOverlapMax: 10, candidateMultiplier: 8, weightCoverage: 18, weightOverlap: 35 },
        qn: { minGap: 20, maxIntersect: 1, candidateMultiplier: 8, weightCoverage: 20, weightDispersion: 8, weightOverlap: 40 }
    }
};

export function getModeParams(slug) {
    const s = slug === 'lotofacil' ? 'lf' : 'qn';
    return MODES[state.generationMode][s];
}

// Global initialization for currentGamesData
state.activeGames.forEach(g => {
    state.currentGamesData[g.slug] = {
        games: [],
        selected: new Set(),
        includeFixed: new Set(),
        excludeFixed: new Set()
    };
});
