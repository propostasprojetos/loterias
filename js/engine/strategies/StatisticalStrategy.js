// ==========================================
// StatisticalStrategy.js - Base Generator
// ==========================================

import { metricsCalculator } from '../MetricsCalculator.js';

export class StatisticalStrategy {
    constructor() {
        this.name = 'Statistical';
    }

    /**
     * Executes the generation logic
     * @param {number} count - Amount of games to generate
     * @param {Object} params - Config params (pick_size, range_max)
     * @param {Array} history - Array of historical draws (optional here, used for repetition config)
     * @param {Array} keptGames - Array of games the user manually pinned
     * @returns {number[][]} Generated games array
     */
    execute(count, params, history = [], keptGames = []) {
        if (count <= 0) return [];
        
        const poolSize = count * 5; // Generate a larger pool to pick the best from
        const candidates = [];
        const max = params.range_max || 60;
        const pick = params.pick_size || 6;
        const allNumbers = Array.from({length: max}, (_, i) => i + 1);

        // Generate Candidates
        for (let i = 0; i < poolSize * 10 && candidates.length < poolSize; i++) {
            const g = this.shuffle([...allNumbers]).slice(0, pick).sort((a,b) => a-b);
            
            // Hard filters for Statistical Model
            // Ex: Discard games with sequence > 5
            if (metricsCalculator.maxConsec(g) > 5) continue;

            if (!candidates.some(c => c.every((v, idx) => v === g[idx]))) {
                candidates.push(g);
            }
        }

        if (candidates.length === 0) return [];

        const selected = [...keptGames];
        const result = [];

        // Select the most diverse and balanced from the pool
        while (result.length < count) {
            let bestIdx = -1;
            let bestScore = -Infinity;

            for (let i = 0; i < candidates.length; i++) {
                if (!candidates[i]) continue;
                
                let penalty = 0;
                // Penalize intersection with already selected games (boosts diversity)
                for (const sel of selected) {
                    const common = metricsCalculator.countIntersection(candidates[i], sel);
                    if (common >= Math.floor(pick * 0.6)) penalty += 100; // Hard penalty for too similar
                    penalty += common * 10;
                }

                const metrics = metricsCalculator.calculate(candidates[i], params);
                // We want high metric score and low penalty
                const finalScore = metrics.score - penalty;

                if (finalScore > bestScore) {
                    bestScore = finalScore;
                    bestIdx = i;
                }
            }

            if (bestIdx === -1) break;

            result.push(candidates[bestIdx]);
            selected.push(candidates[bestIdx]);
            candidates[bestIdx] = null; // Remove from pool
        }

        return result;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
