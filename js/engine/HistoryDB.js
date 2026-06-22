// ==========================================
// HistoryDB.js - IndexedDB Async Manager
// ==========================================

const DB_NAME = 'LotoSmartHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'draw_history';

class HistoryDB {
    constructor() {
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject(e.target.error);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'slug' });
                }
            };
        });
    }

    async getHistory(slug) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(slug);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveHistory(slug, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = {
                slug,
                data,
                updatedAt: Date.now()
            };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const historyDB = new HistoryDB();
