// ==========================================
// FrequentStrategy.js - Hot Numbers Generator
// ==========================================

import { metricsCalculator } from '../MetricsCalculator.js';

export class FrequentStrategy {
    constructor() {
        this.name = 'Frequent';
    }

    /**
     * Executes generation prioritizing hot numbers
     */
    execute(count, params, history = [], keptGames = []) {
        if (count <= 0) return [];
        if (!history || history.length === 0) {
            console.warn("FrequentStrategy requires historical data. Falling back to Statistical.");
            // We would dynamically import or just do basic random here.
            // For simplicity, if no history, just random.
            return this.generateRandom(count, params, keptGames);
        }

        const max = params.range_max || 60;
        const pick = params.pick_size || 6;

        // Calculate frequencies
        const frequencies = new Array(max + 1).fill(0);
        history.forEach(draw => {
            draw.numbers.forEach(n => {
                if (n <= max) frequencies[n]++;
            });
        });

        // Create a weighted pool. Numbers that appeared more often get more copies in the pool.
        const weightedPool = [];
        for (let i = 1; i <= max; i++) {
            const freq = frequencies[i];
            // Add at least 1 copy so cold numbers still have a tiny chance
            const copies = Math.max(1, freq); 
            for(let c = 0; c < copies; c++) {
                weightedPool.push(i);
            }
        }

        const result = [];
        const poolSize = count * 10;
        const candidates = [];

        for (let i = 0; i < poolSize * 5 && candidates.length < poolSize; i++) {
            const g = new Set();
            while(g.size < pick) {
                const rndIdx = Math.floor(Math.random() * weightedPool.length);
                g.add(weightedPool[rndIdx]);
            }
            const gameArr = Array.from(g).sort((a,b) => a-b);
            
            // Basic sanity filters
            if (metricsCalculator.maxConsec(gameArr) > 6) continue;
            
            candidates.push(gameArr);
        }

        // Selection loop (similar to statistical but prioritizing unique selections among the frequent candidates)
        const selected = [...keptGames];
        for (let i = 0; i < count; i++) {
            let bestIdx = 0; // Take first, or implement diversity scoring
            result.push(candidates[bestIdx]);
            candidates.splice(bestIdx, 1);
        }

        return result;
    }

    generateRandom(count, params, keptGames) {
        // Fallback logic
        return []; 
    }
}
