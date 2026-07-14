// ==========================================
// StatisticalStrategy.js - Base Generator
// ==========================================

import { metricsCalculator } from '../MetricsCalculator.js';
import { getRulesForGame } from '../GameRules.js';

export class StatisticalStrategy {
    constructor() {
        this.name = 'Statistical';
    }

    /**
     * Executes the generation logic
     * @param {number} count - Amount of games to generate
     * @param {Object} params - Config params (pick_size, range_max, slug)
     * @param {Array} history - Array of historical draws
     * @param {Array} keptGames - Array of games the user manually pinned
     * @returns {number[][]} Generated games array
     */
    execute(count, params, history = [], keptGames = []) {
        if (count <= 0) return [];

        const slug = params.slug || 'generic';
        const rules = getRulesForGame(slug);

        // Dispatch to special generators
        if (rules.specialMode === 'lotomania') {
            return this.generateLotomania(count, params, rules, keptGames);
        }
        if (rules.specialMode === 'supersete') {
            return this.generateSuperSete(count, params, rules, keptGames);
        }

        // Standard pick-N-from-M generation
        return this.generateStandard(count, params, rules, keptGames);
    }

    // ==========================================================
    // STANDARD GENERATOR (Mega-Sena, Dupla Sena, Quina, etc.)
    // ==========================================================
    generateStandard(count, params, rules, keptGames) {
        const poolSize = count * rules.poolMultiplier;
        const candidates = [];
        const max = params.range_max || 60;
        const min = params.range_min || 1;
        const pick = params.pick_size || 6;
        const allNumbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

        for (let i = 0; i < poolSize * 15 && candidates.length < poolSize; i++) {
            const g = this.shuffle([...allNumbers]).slice(0, pick).sort((a, b) => a - b);

            // --- FILTROS BASEADOS NAS REGRAS DO JOGO ---
            // 1. Consecutivos
            if (metricsCalculator.maxConsec(g) > rules.maxConsec) continue;

            // 2. Distribuição por dezena (ranges)
            if (this.countDecades(g) < rules.minRanges) continue;

            // 3. Equilíbrio pares/ímpares
            const evens = metricsCalculator.countEven(g);
            if (Math.abs(evens - (pick - evens)) > rules.balanceTolerance) continue;

            // 4. Soma dentro da faixa típica
            const sum = g.reduce((a, b) => a + b, 0);
            if (sum < rules.sumRange[0] || sum > rules.sumRange[1]) continue;

            // 5. Máximo de números na mesma dezena
            if (this.maxInSameDecade(g) > rules.maxSameDecade) continue;

            // 6. Sem duplicata exata
            if (!candidates.some(c => c.every((v, idx) => v === g[idx]))) {
                candidates.push(g);
            }
        }

        if (candidates.length === 0) return [];

        return this.selectBest(candidates, count, params, rules, keptGames);
    }

    // ==========================================================
    // LOTOMANIA GENERATOR (50 de 0–99)
    // ==========================================================
    generateLotomania(count, params, rules, keptGames) {
        const poolSize = count * rules.poolMultiplier;
        const candidates = [];
        const max = params.range_max ?? 99;
        const min = params.range_min ?? 0;
        const pick = params.pick_size || 50;
        const totalNumbers = max - min + 1; // 100

        for (let i = 0; i < poolSize * 20 && candidates.length < poolSize; i++) {
            // Para 50 de 100, é mais eficiente gerar a metade a ser EXCLUÍDA
            const allNums = Array.from({ length: totalNumbers }, (_, i) => i + min);
            const excluded = new Set();
            while (excluded.size < totalNumbers - pick) {
                excluded.add(allNums[Math.floor(Math.random() * totalNumbers)]);
            }
            const g = allNums.filter(n => !excluded.has(n)).sort((a, b) => a - b);

            // Filtros Lotomania
            const evens = g.filter(n => n % 2 === 0).length;
            if (Math.abs(evens - (pick - evens)) > rules.balanceTolerance) continue;

            // Distribuição por dezena: deve cobrir pelo menos 9 das 10 dezenas
            if (this.countDecades(g) < 9) continue;

            // Soma
            const sum = g.reduce((a, b) => a + b, 0);
            if (sum < rules.sumRange[0] || sum > rules.sumRange[1]) continue;

            if (!candidates.some(c => c.length === g.length && c.every((v, idx) => v === g[idx]))) {
                candidates.push(g);
            }
        }

        if (candidates.length === 0) return [];

        return this.selectBest(candidates, count, params, rules, keptGames);
    }

    // ==========================================================
    // SUPER SETE GENERATOR (7 colunas, 0–9 cada)
    // ==========================================================
    generateSuperSete(count, params, rules, keptGames) {
        const poolSize = count * rules.poolMultiplier;
        const candidates = [];
        const columns = 7;

        for (let i = 0; i < poolSize * 20 && candidates.length < poolSize; i++) {
            const g = [];
            for (let col = 0; col < columns; col++) {
                g.push(Math.floor(Math.random() * 10)); // 0–9
            }

            // Filtro: soma entre 15 e 50 (evita extremos tipo 0000000 ou 9999999)
            const sum = g.reduce((a, b) => a + b, 0);
            if (sum < rules.sumRange[0] || sum > rules.sumRange[1]) continue;

            // Filtro: pelo menos 4 dígitos diferentes (diversidade)
            const unique = new Set(g).size;
            if (unique < 4) continue;

            // Filtro: não mais que 3 dígitos iguais
            const freq = {};
            g.forEach(n => freq[n] = (freq[n] || 0) + 1);
            if (Math.max(...Object.values(freq)) > 3) continue;

            // Sem duplicatas exatas
            if (!candidates.some(c => c.every((v, idx) => v === g[idx]))) {
                candidates.push(g);
            }
        }

        if (candidates.length === 0) return [];

        // Seleção simplificada para Super Sete (sem métricas tradicionais)
        const selected = [...keptGames];
        const result = [];

        while (result.length < count && candidates.length > 0) {
            let bestIdx = 0;
            let bestScore = -Infinity;

            for (let i = 0; i < candidates.length; i++) {
                if (!candidates[i]) continue;
                let penalty = 0;
                for (const sel of selected) {
                    const common = candidates[i].filter((v, idx) => v === sel[idx]).length;
                    if (common >= 5) penalty += 200;
                    penalty += common * 15;
                }
                const sum = candidates[i].reduce((a, b) => a + b, 0);
                const unique = new Set(candidates[i]).size;
                const score = (unique * 10) + (sum * 0.5) - penalty;

                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                }
            }

            if (bestIdx === -1 || !candidates[bestIdx]) break;
            result.push(candidates[bestIdx]);
            selected.push(candidates[bestIdx]);
            candidates[bestIdx] = null;
        }

        return result;
    }

    // ==========================================================
    // SELEÇÃO DOS MELHORES CANDIDATOS (compartilhado)
    // ==========================================================
    selectBest(candidates, count, params, rules, keptGames) {
        const pick = params.pick_size || 6;
        const selected = [...keptGames];
        const result = [];

        while (result.length < count) {
            let bestIdx = -1;
            let bestScore = -Infinity;

            for (let i = 0; i < candidates.length; i++) {
                if (!candidates[i]) continue;

                let penalty = 0;
                for (const sel of selected) {
                    const common = metricsCalculator.countIntersection(candidates[i], sel);
                    if (common >= Math.floor(pick * 0.6)) penalty += rules.overlapPenalty;
                    penalty += common * 10;
                }

                const metrics = metricsCalculator.calculate(candidates[i], params);
                const finalScore = metrics.score - penalty;

                if (finalScore > bestScore) {
                    bestScore = finalScore;
                    bestIdx = i;
                }
            }

            if (bestIdx === -1) break;

            result.push(candidates[bestIdx]);
            selected.push(candidates[bestIdx]);
            candidates[bestIdx] = null;
        }

        return result;
    }

    // ==========================================================
    // HELPERS
    // ==========================================================
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /** Conta quantas dezenas diferentes o jogo cobre (01-10, 11-20, etc.) */
    countDecades(arr) {
        const decades = new Set();
        arr.forEach(n => decades.add(Math.floor(n / 10)));
        return decades.size;
    }

    /** Retorna o máximo de números na mesma dezena */
    maxInSameDecade(arr) {
        const freq = {};
        arr.forEach(n => {
            const d = Math.floor(n / 10);
            freq[d] = (freq[d] || 0) + 1;
        });
        return Math.max(...Object.values(freq));
    }
}
