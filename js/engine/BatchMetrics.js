// ==========================================
// BatchMetrics.js - Global Set Analysis
// ==========================================

export class BatchMetrics {
    /**
     * Calculates the diversity (average Hamming distance) of the batch.
     * High diversity means games are very different from each other.
     * @param {number[][]} batch - Array of generated games
     * @returns {number} Average unique numbers between any pair of games (0-100 score)
     */
    static calculateDiversityScore(batch) {
        if (!batch || batch.length < 2) return 100;
        
        let totalComparisons = 0;
        let totalUnique = 0;
        
        // Compare every game against every other game (O(n^2/2))
        for (let i = 0; i < batch.length; i++) {
            for (let j = i + 1; j < batch.length; j++) {
                const intersect = batch[i].filter(v => batch[j].includes(v)).length;
                const unique = batch[i].length - intersect; 
                totalUnique += unique;
                totalComparisons++;
            }
        }
        
        const avgUnique = totalUnique / totalComparisons;
        const maxPossibleUnique = batch[0].length;
        
        // Diversity score as percentage
        const score = (avgUnique / maxPossibleUnique) * 100;
        return Math.min(100, Math.max(0, Math.round(score * 1.5))); // Amplified for readability
    }
}
