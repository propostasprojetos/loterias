// ==========================================
// CaixaProvider.js - Main API Data Source
// ==========================================

export class CaixaProvider {
    constructor() {
        // We use a known public API. If it changes, we just update here.
        this.baseUrl = 'https://loteriascaixa-api.herokuapp.com/api';
    }

    // Map internal slugs to API path names
    mapSlug(slug) {
        const map = {
            'lf': 'lotofacil',
            'qn': 'quina',
            'ms': 'megasena',
            'lm': 'lotomania',
            'dp': 'duplasena',
            'ds': 'diadesorte',
            'sm': 'supersete',
            'ma': 'maismilionaria',
            'tm': 'timemania'
        };
        return map[slug] || slug;
    }

    /**
     * Fetches the latest N results for a given lottery
     * API returns all results if no specific contest is provided, so we fetch all and slice.
     */
    async fetchHistory(slug, limit = 500) {
        const apiSlug = this.mapSlug(slug);
        try {
            const res = await fetch(`${this.baseUrl}/${apiSlug}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const data = await res.json();
            
            // The API returns an array of objects for each draw.
            // Format example: { concurso: 1, data: "...", dezenas: ["01", "02", ...] }
            
            // Sort by contest number descending (newest first)
            data.sort((a, b) => b.concurso - a.concurso);
            
            // Extract limit
            const recent = data.slice(0, limit);
            
            // Parse numbers to integers
            const parsed = recent.map(draw => ({
                id: draw.concurso,
                date: draw.data,
                numbers: draw.dezenas.map(n => parseInt(n, 10))
            }));
            
            return parsed;
        } catch (err) {
            console.error(`CaixaProvider: Failed to fetch ${slug} history`, err);
            throw err;
        }
    }
}
