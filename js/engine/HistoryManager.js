// ==========================================
// HistoryManager.js - Caching & Orchestration
// ==========================================

import { historyDB } from './HistoryDB.js';
import { CaixaProvider } from './providers/CaixaProvider.js';
import { FallbackProvider } from './providers/FallbackProvider.js';

const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class HistoryManager {
    constructor() {
        this.primary = new CaixaProvider();
        this.fallback = new FallbackProvider();
    }

    async getHistory(slug) {
        try {
            // 1. Check local IndexedDB
            const cached = await historyDB.getHistory(slug);
            const now = Date.now();

            if (cached && cached.data && cached.updatedAt) {
                const age = now - cached.updatedAt;
                if (age < CACHE_EXPIRATION_MS) {
                    console.log(`[HistoryManager] Using valid cache for ${slug}`);
                    return cached.data;
                }
                console.log(`[HistoryManager] Cache expired for ${slug}. Fetching fresh...`);
            } else {
                console.log(`[HistoryManager] No cache for ${slug}. Fetching fresh...`);
            }

            // 2. Try Primary Provider
            try {
                const freshData = await this.primary.fetchHistory(slug);
                await historyDB.saveHistory(slug, freshData);
                return freshData;
            } catch (err) {
                console.warn(`[HistoryManager] Primary provider failed for ${slug}`, err);
                // 3. Try Fallback Provider
                try {
                    const fallbackData = await this.fallback.fetchHistory(slug);
                    await historyDB.saveHistory(slug, fallbackData);
                    return fallbackData;
                } catch (fallbackErr) {
                    console.error(`[HistoryManager] All providers failed for ${slug}`, fallbackErr);
                    // 4. Return expired cache if available as last resort
                    if (cached && cached.data) {
                        console.warn(`[HistoryManager] Serving expired cache for ${slug} due to API failure`);
                        return cached.data;
                    }
                    throw new Error('No historical data available and offline.');
                }
            }
        } catch (e) {
            console.error('HistoryManager Error:', e);
            return [];
        }
    }
    /**
     * Returns the next (vigente) contest number for a given lottery slug.
     * Uses a short-lived localStorage cache (1 hour) to avoid repeated API calls.
     */
    async getLatestContest(slug) {
        const CACHE_KEY = `lotosmart_contest_${slug}`;
        const CACHE_TTL = 60 * 60 * 1000; // 1 hora
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
                return cached.data;
            }
        } catch (_) {}

        const data = await this.primary.fetchLatestContest(slug);
        if (data) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
            } catch (_) {}
        }
        return data;
    }
}

export const historyManager = new HistoryManager();
