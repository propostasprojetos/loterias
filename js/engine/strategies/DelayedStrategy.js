// ==========================================
// DelayedStrategy.js - Cold Numbers Generator
// ==========================================

import { metricsCalculator } from '../MetricsCalculator.js';
import { getRulesForGame } from '../GameRules.js';

export class DelayedStrategy {
    constructor() {
        this.name = 'Delayed';
    }

    execute(count, params, history = [], keptGames = []) {
        if (count <= 0) return [];
        if (!history || history.length === 0) return [];

        const slug = params.slug || 'generic';
        const rules = getRulesForGame(slug);

        const max = params.range_max || 60;
        const min = params.range_min || 1;
        const pick = params.pick_size || 6;

        // Calculate delay (how many contests since last appearance)
        const delays = new Array(max + 1).fill(history.length);
        const seen = new Set();
        for (let i = 0; i < history.length; i++) {
            (history[i].numbers || []).forEach(n => {
                if (n >= min && n <= max && !seen.has(n)) {
                    delays[n] = i;
                    seen.add(n);
                }
            });
            if (seen.size >= (max - min + 1)) break;
        }

        // Create weighted pool based on delays
        const weightedPool = [];
        for (let i = min; i <= max; i++) {
            const delay = delays[i];
            const copies = Math.max(1, delay);
            for (let c = 0; c < copies; c++) {
                weightedPool.push(i);
            }
        }

        const poolSize = count * rules.poolMultiplier;
        const candidates = [];

        for (let i = 0; i < poolSize * 8 && candidates.length < poolSize; i++) {
            const g = new Set();
            while (g.size < pick) {
                const rndIdx = Math.floor(Math.random() * weightedPool.length);
                g.add(weightedPool[rndIdx]);
            }
            const gameArr = Array.from(g).sort((a, b) => a - b);

            // Apply game-specific filters
            if (metricsCalculator.maxConsec(gameArr) > rules.maxConsec) continue;

            const evens = metricsCalculator.countEven(gameArr);
            if (Math.abs(evens - (pick - evens)) > rules.balanceTolerance) continue;

            const sum = gameArr.reduce((a, b) => a + b, 0);
            if (sum < rules.sumRange[0] || sum > rules.sumRange[1]) continue;

            candidates.push(gameArr);
        }

        // Selection with diversity
        const selected = [...keptGames];
        const result = [];

        for (let i = 0; i < count && candidates.length > 0; i++) {
            let bestIdx = 0;
            let bestScore = -Infinity;

            for (let j = 0; j < candidates.length; j++) {
                if (!candidates[j]) continue;
                let penalty = 0;
                for (const sel of selected) {
                    const common = metricsCalculator.countIntersection(candidates[j], sel);
                    if (common >= Math.floor(pick * 0.6)) penalty += rules.overlapPenalty;
                    penalty += common * 10;
                }
                const metrics = metricsCalculator.calculate(candidates[j], params);
                const score = metrics.score - penalty;
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = j;
                }
            }

            if (!candidates[bestIdx]) break;
            result.push(candidates[bestIdx]);
            selected.push(candidates[bestIdx]);
            candidates[bestIdx] = null;
        }

        return result;
    }
}
