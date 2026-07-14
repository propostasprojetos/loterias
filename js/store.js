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
    activeGames: [],       // Populated dynamically from Supabase
    currentGamesData: {}   // Populated dynamically
};

export const MODES = {
    conservative: {
        label: 'Conservador',
        default: { maxIntersect: 10, baseOverlapMin: 9, baseOverlapMax: 11, candidateMultiplier: 4, weightCoverage: 12, weightOverlap: 15 }
    },
    balanced: {
        label: 'Balanceado',
        default: { maxIntersect: 9, baseOverlapMin: 8, baseOverlapMax: 11, candidateMultiplier: 6, weightCoverage: 15, weightOverlap: 25 }
    },
    aggressive: {
        label: 'Agressivo',
        default: { maxIntersect: 8, baseOverlapMin: 7, baseOverlapMax: 10, candidateMultiplier: 8, weightCoverage: 18, weightOverlap: 35 }
    }
};

export function getModeParams(slug) {
    const mode = MODES[state.generationMode] || MODES.conservative;
    return mode.default;
}
