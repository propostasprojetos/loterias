// ==========================================
// MetricsCalculator.js - Game Mathematics & Quality
// ==========================================

export class MetricsCalculator {
    constructor(config = {}) {
        // Allow configurable weights for the final score
        this.weights = {
            balance: config.balance || 4,
            variance: config.variance || 2,
            distribution: config.distribution || 3,
            ...config
        };
    }

    /**
     * Calculates all individual metrics for a game array.
     * @param {number[]} game - The sorted array of numbers
     * @param {Object} params - Game params (e.g. range_max, rows, cols)
     * @param {number[]} lastDraw - Optional array of last draw numbers to check repetition
     */
    calculate(game, params, lastDraw = null) {
        const evens = this.countEven(game);
        const odds = game.length - evens;
        const balance = Math.abs(evens - odds);
        const sum = game.reduce((a, b) => a + b, 0);
        const consec = this.maxConsec(game);
        const gaps = this.calcGaps(game);
        const avgG = gaps.length ? (gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(1) : 0;
        
        const rStr = this.countRanges(game);
        const repetition = lastDraw ? this.countIntersection(game, lastDraw) : 0;

        // Basic distribution assuming default grid layout (e.g. 5 cols)
        const cols = params.cols || 5; 
        const { rowsDist, colsDist } = this.calcGridDistribution(game, cols);

        // Score Calculation
        let score = 98 - (balance * this.weights.balance) - (consec * this.weights.variance);
        if (score < 50) score = 50 + Math.floor(Math.random() * 20);
        if (score > 100) score = 100;

        let sClass = score >= 90 ? 'high' : score >= 80 ? 'med' : 'low';
        let sLabel = score >= 90 ? 'Excelente' : score >= 80 ? 'Bom' : 'Regular';

        return {
            evens, odds, balance, sum, consec, avgG, rStr, repetition, 
            rowsDist, colsDist, score, sClass, sLabel
        };
    }

    countEven(arr) {
        return arr.filter(n => n % 2 === 0).length;
    }

    maxConsec(arr) {
        if (!arr.length) return 0;
        let max = 1, curr = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[i - 1] + 1) {
                curr++;
                if (curr > max) max = curr;
            } else {
                curr = 1;
            }
        }
        return max;
    }

    calcGaps(arr) {
        const gaps = [];
        for (let i = 1; i < arr.length; i++) {
            gaps.push(arr[i] - arr[i - 1]);
        }
        return gaps;
    }

    countRanges(arr) {
        const ranges = {};
        arr.forEach(n => {
            const r = Math.floor((n - 1) / 10) * 10;
            ranges[r] = (ranges[r] || 0) + 1;
        });
        return Object.keys(ranges).length;
    }

    countIntersection(arr1, arr2) {
        return arr1.filter(value => arr2.includes(value)).length;
    }

    calcGridDistribution(arr, colCount) {
        const rows = {};
        const cols = {};
        arr.forEach(n => {
            const r = Math.floor((n - 1) / colCount);
            const c = (n - 1) % colCount;
            rows[r] = (rows[r] || 0) + 1;
            cols[c] = (cols[c] || 0) + 1;
        });
        return {
            rowsDist: Object.keys(rows).length,
            colsDist: Object.keys(cols).length
        };
    }
}

export const metricsCalculator = new MetricsCalculator();
