// ==========================================
// GameRules.js - Game-Specific Generation Rules
// ==========================================
// Each game has constraints that guide the generator
// to produce statistically plausible combinations.

export const GAME_RULES = {

    // MEGA-SENA: 6 de 60
    megasena: {
        maxConsec: 3,           // Máx. números consecutivos permitidos
        minRanges: 3,           // Mín. dezenas diferentes (01-10, 11-20, etc.)
        balanceTolerance: 2,    // Diferença máx. pares/ímpares (ideal: 3/3)
        sumRange: [100, 260],   // Faixa de soma típica nos sorteios reais
        maxSameDecade: 3,       // Máx. números na mesma dezena
        overlapPenalty: 60,     // Penalidade por % de sobreposição com outro jogo
        poolMultiplier: 8       // Candidatos = qty * poolMultiplier
    },

    // LOTOFÁCIL: 15 de 25
    lotofacil: {
        maxConsec: 5,
        minRanges: 3,
        balanceTolerance: 3,    // 7/8 ou 8/7 ideal
        sumRange: [170, 225],
        maxSameDecade: 6,
        overlapPenalty: 100,
        poolMultiplier: 5
    },

    // QUINA: 5 de 80
    quina: {
        maxConsec: 3,
        minRanges: 3,
        balanceTolerance: 2,
        sumRange: [80, 280],
        maxSameDecade: 2,
        overlapPenalty: 80,
        poolMultiplier: 6
    },

    // +MILIONÁRIA: 6 de 50
    maismilionaria: {
        maxConsec: 3,
        minRanges: 3,
        balanceTolerance: 2,
        sumRange: [70, 210],
        maxSameDecade: 3,
        overlapPenalty: 60,
        poolMultiplier: 8
    },

    // DIA DE SORTE: 7 de 31
    diadesorte: {
        maxConsec: 3,
        minRanges: 2,
        balanceTolerance: 2,
        sumRange: [80, 160],
        maxSameDecade: 4,
        overlapPenalty: 70,
        poolMultiplier: 6
    },

    // DUPLA SENA: 6 de 50
    duplasena: {
        maxConsec: 3,
        minRanges: 3,
        balanceTolerance: 2,
        sumRange: [70, 210],
        maxSameDecade: 3,
        overlapPenalty: 60,
        poolMultiplier: 8
    },

    // TIMEMANIA: 10 de 80
    timemania: {
        maxConsec: 4,
        minRanges: 4,
        balanceTolerance: 3,
        sumRange: [200, 500],
        maxSameDecade: 3,
        overlapPenalty: 80,
        poolMultiplier: 6
    },

    // LOTOMANIA: 50 de 100 (0–99) — Regras especiais
    lotomania: {
        maxConsec: 8,
        minRanges: 10,          // Deve cobrir todas as 10 dezenas (0–9, 10–19, etc.)
        balanceTolerance: 4,    // 25/25 ideal, aceita 23/27
        sumRange: [2200, 2700], // Soma típica de 50 números de 0 a 99
        maxSameDecade: 8,
        overlapPenalty: 200,
        poolMultiplier: 3,
        specialMode: 'lotomania' // Flag para lógica especial de geração
    },

    // SUPER SETE: 7 colunas, 0–9 cada — Regras especiais
    supersete: {
        maxConsec: 7,           // Não se aplica da mesma forma
        minRanges: 1,
        balanceTolerance: 3,
        sumRange: [15, 50],     // Soma de 7 dígitos (0–9)
        maxSameDecade: 7,
        overlapPenalty: 40,
        poolMultiplier: 10,
        specialMode: 'supersete' // Flag para lógica de colunas independentes
    }
};

/**
 * Retorna as regras para um slug de jogo.
 * Se o slug não tiver regras cadastradas, retorna um fallback genérico.
 */
export function getRulesForGame(slug) {
    if (GAME_RULES[slug]) return GAME_RULES[slug];

    // Fallback genérico para jogos novos/desconhecidos
    return {
        maxConsec: 5,
        minRanges: 2,
        balanceTolerance: 3,
        sumRange: [0, Infinity],
        maxSameDecade: 10,
        overlapPenalty: 50,
        poolMultiplier: 5,
        specialMode: null
    };
}
