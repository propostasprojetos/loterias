// ==========================================
// StrategyEngine.js - Engine Orchestrator
// ==========================================

import { StatisticalStrategy } from './strategies/StatisticalStrategy.js';
import { FrequentStrategy } from './strategies/FrequentStrategy.js';
import { DelayedStrategy } from './strategies/DelayedStrategy.js';

class StrategyEngine {
    constructor() {
        this.strategies = {
            'statistical': new StatisticalStrategy(),
            'frequent': new FrequentStrategy(),
            'delayed': new DelayedStrategy()
            // hybrid and correlation will be added here
        };
    }

    getStrategyNames() {
        return Object.keys(this.strategies);
    }

    /**
     * Run the engine for a specific strategy
     * @param {string} strategyName 
     * @param {number} count 
     * @param {Object} params 
     * @param {Array} history 
     * @param {Array} keptGames 
     */
    run(strategyName, count, params, history = [], keptGames = []) {
        const strategy = this.strategies[strategyName] || this.strategies['statistical'];
        console.log(`[StrategyEngine] Running ${strategy.name} strategy to generate ${count} games.`);
        return strategy.execute(count, params, history, keptGames);
    }
}

export const strategyEngine = new StrategyEngine();
