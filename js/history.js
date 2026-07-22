// ==========================================
// history.js - Local History Management
// ==========================================

import { state } from './store.js';
import { $, $$, toast, showConfirm } from './utils.js';
import { switchView } from './ui.js';
import { renderGames, renderAnalysis } from './gerador.js';

function getHistoryKey() {
    return state.currentSession ? `lotosmart_history_${state.currentSession.user.id}` : 'lotosmart_history';
}

export function loadHistory() {
    try { return JSON.parse(localStorage.getItem(getHistoryKey())) || []; }
    catch { return []; }
}

export function saveHistoryData(data) { 
    localStorage.setItem(getHistoryKey(), JSON.stringify(data)); 
}

export function saveToHistory() {
    const history = loadHistory();
    const entry = {
        id: Date.now(),
        date: new Date().toLocaleString('pt-BR'),
        gamesData: {}
    };
    
    state.activeGames.forEach(g => {
        if(state.currentGamesData[g.slug]) {
            entry.gamesData[g.slug] = state.currentGamesData[g.slug].games;
        }
    });

    history.unshift(entry);
    if (history.length > 50) history.length = 50;
    saveHistoryData(history);
    renderHistory();
}

export function deleteHistoryEntry(id) {
    const history = loadHistory().filter(h => h.id !== id);
    saveHistoryData(history);
    renderHistory();
}

export function clearHistory() {
    showConfirm('Limpar Histórico', 'Deseja realmente apagar todo o histórico de jogos gerados localmente?', () => {
        saveHistoryData([]);
        renderHistory();
        toast('Histórico limpo!', 'success');
    });
}

export function loadFromHistory(entry) {
    state.activeGames.forEach(g => {
        if(entry.gamesData[g.slug]) {
            state.currentGamesData[g.slug] = {
                games: entry.gamesData[g.slug],
                selected: new Set(),
                page: 0
            };
        }
    });
    
    switchView('gerador');
    renderGames();
    renderAnalysis();
    $('results-area').classList.remove('hidden');
    $('btn-generate').textContent = 'Gerar Jogos';
    toast('Jogos carregados do histórico');
}

export function renderHistory() {
    const history = loadHistory();
    const el = $('history-list');
    const empty = $('history-empty');

    if (!el || !empty) return;

    if (!history.length) {
        el.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    el.innerHTML = history.map(h => {
        return `<div class="history-entry" data-id="${h.id}">
            <div class="history-entry-header">
                <span class="history-date">${h.date}</span>
                <span class="history-summary">${Object.keys(h.gamesData).length} loteria(s) salvos</span>
            </div>
            <div class="history-body">
                <div class="history-actions">
                    <button class="btn-sm btn-load-hist">Carregar</button>
                    <button class="btn-sm btn-danger btn-del-hist">Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');

    $$('.history-entry-header').forEach(hdr => {
        hdr.addEventListener('click', (e) => {
            const entry = e.currentTarget.parentElement;
            entry.classList.toggle('expanded');
        });
    });

    $$('.btn-del-hist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.closest('.history-entry').dataset.id);
            showConfirm('Excluir Histórico', 'Deseja excluir este histórico de jogos?', () => {
                deleteHistoryEntry(id);
                toast('Histórico excluído');
            });
        });
    });

    $$('.btn-load-hist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.closest('.history-entry').dataset.id);
            const entry = loadHistory().find(h => h.id === id);
            if(entry) loadFromHistory(entry);
        });
    });
}
