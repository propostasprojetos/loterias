// ==========================================
// FallbackProvider.js - Secondary Data Source
// ==========================================

export class FallbackProvider {
    constructor() {
        // Fallback API / mock generator if main API is down
        // For a true enterprise app, this would hit an alternative endpoint.
        // Here we can generate realistic historical distributions or hit a secondary free API.
    }

    async fetchHistory(slug, limit = 100) {
        console.warn(`[FallbackProvider] Providing fallback data for ${slug}`);
        // Instead of returning dummy, returning empty or throwing will force DB fallback
        throw new Error('Fallback provider not fully implemented for real data yet.');
    }
}
