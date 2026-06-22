// ==========================================
// DelayedStrategy.js - Cold Numbers Generator
// ==========================================

import { metricsCalculator } from '../MetricsCalculator.js';

export class DelayedStrategy {
    constructor() {
        this.name = 'Delayed';
    }

    execute(count, params, history = [], keptGames = []) {
        if (count <= 0) return [];
        if (!history || history.length === 0) return [];

        const max = params.range_max || 60;
        const pick = params.pick_size || 6;

        // Calculate delay (how many contests since last appearance)
        const delays = new Array(max + 1).fill(history.length); // Initialize with max possible delay
        
        // Iterate from oldest to newest to find the last appearance
        // Wait, history is ordered newest first (index 0 is newest).
        // So we just iterate and the first time we see a number, its delay is the index.
        const seen = new Set();
        for (let i = 0; i < history.length; i++) {
            history[i].numbers.forEach(n => {
                if (n <= max && !seen.has(n)) {
                    delays[n] = i;
                    seen.add(n);
                }
            });
            if (seen.size === max) break; // All numbers found
        }

        // Create weighted pool based on delays (higher delay = more copies)
        const weightedPool = [];
        for (let i = 1; i <= max; i++) {
            const delay = delays[i];
            const copies = Math.max(1, delay); 
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
            if (metricsCalculator.maxConsec(gameArr) > 6) continue;
            candidates.push(gameArr);
        }

        for (let i = 0; i < count; i++) {
            result.push(candidates[i]);
        }

        return result;
    }
}
