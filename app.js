// ==========================================
// app.js - Main Client Application (Module)
// ==========================================

import { strategyEngine } from './js/engine/StrategyEngine.js';
import { historyManager } from './js/engine/HistoryManager.js';
import { metricsCalculator } from './js/engine/MetricsCalculator.js';

// ===== UTILS =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const pad = n => n.toString().padStart(2, '0');
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Exporting helpers to window so they are available globally (e.g. for admin.js) when used as modules
window.$ = $;
window.$$ = $$;
window.pad = pad;
window.fmt = fmt;

const ICON = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>`
};

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i);[a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
function countEven(n) { return n.filter(x => x % 2 === 0).length; }
function maxConsec(nums) {
    const s = [...nums].sort((a, b) => a - b);
    let mx = 1, c = 1;
    for (let i = 1; i < s.length; i++) { if (s[i] === s[i - 1] + 1) { c++; mx = Math.max(mx, c); } else c = 1; }
    return mx;
}
function intersect(a, b) { return a.filter(n => b.includes(n)); }
function renderBall(n, slug) {
    const isEven = n % 2 === 0;
    const isQn = slug === 'quina';
    return `<div class="ball ${isEven ? 'even' : 'odd'} ${isQn ? 'qn' : ''}">${pad(n)}</div>`;
}

// ===== MODE CONFIGURATION =====
const MODES = {
    conservative: {
        label: 'Conservador',
        lf: { maxIntersect: 10, baseOverlapMin: 9, baseOverlapMax: 11, candidateMultiplier: 4, weightCoverage: 12, weightOverlap: 15 },
        qn: { minGap: 12, maxIntersect: 2, candidateMultiplier: 4, weightCoverage: 12, weightDispersion: 3, weightOverlap: 20 }
    },
    balanced: {
        label: 'Balanceado',
        lf: { maxIntersect: 9, baseOverlapMin: 8, baseOverlapMax: 11, candidateMultiplier: 6, weightCoverage: 15, weightOverlap: 25 },
        qn: { minGap: 15, maxIntersect: 2, candidateMultiplier: 6, weightCoverage: 15, weightDispersion: 6, weightOverlap: 30 }
    },
    aggressive: {
        label: 'Agressivo',
        lf: { maxIntersect: 8, baseOverlapMin: 8, baseOverlapMax: 10, candidateMultiplier: 8, weightCoverage: 20, weightOverlap: 40 },
        qn: { minGap: 18, maxIntersect: 1, candidateMultiplier: 8, weightCoverage: 20, weightDispersion: 12, weightOverlap: 50 }
    }
};

let generationMode = 'balanced';
function getModeConfig() { return MODES[generationMode]; }

// ===== GENERIC GAME ENGINE =====

let activeGames = [];
let currentGamesData = {}; 

async function loadAvailableGames() {
    if (!currentProfile) return;
    try {
        const { data: allGames } = await supabaseClient.from('jogos').select('*').eq('status', 'ativo').order('ordem');
        let planGameIds = [];
        if (currentProfile.plano_id) {
            const { data: pj } = await supabaseClient.from('plano_jogos').select('jogo_id').eq('plano_id', currentProfile.plano_id);
            if (pj) planGameIds = pj.map(p => p.jogo_id);
        }
        
        const modulos = currentProfile.modulos_customizados || {};
        activeGames = (allGames || []).filter(g => {
            if (window.isSuperAdmin) return true;
            if (modulos[g.slug] !== undefined) return modulos[g.slug];
            return planGameIds.includes(g.id);
        });

        currentGamesData = {};
        activeGames.forEach(g => {
            currentGamesData[g.slug] = { games: [], selected: new Set(), page: 0 };
        });

        renderDynamicGameUI();
    } catch(e) { console.error('Erro ao carregar jogos:', e); }
}

function renderDynamicGameUI() {
    const configGrid = $('config-grid');
    if (configGrid) {
        if (activeGames.length === 0) {
            configGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-2);">
                    <p style="margin-bottom: 10px;">Você não possui nenhum plano ou módulo de jogos ativo.</p>
                    <p style="font-size: 0.9em; opacity: 0.7;">Por favor, contate o administrador para liberar o seu acesso aos jogos.</p>
                </div>
            `;
            const summaryBar = $('summary-bar');
            if (summaryBar) summaryBar.innerHTML = '';
            const tabsContainer = $('dynamic-tabs');
            const contentsContainer = $('dynamic-tab-contents');
            if (tabsContainer) tabsContainer.innerHTML = '';
            if (contentsContainer) contentsContainer.innerHTML = '';
            return;
        }

        configGrid.innerHTML = activeGames.map(g => {
            const cost = g.parametros.cost || 3.00;
            return `
                <div class="field">
                    <label title="Digite a quantidade de jogos para ${g.nome} (Custo unitário: R$ ${cost.toFixed(2)})">${g.nome}</label>
                    <div class="input-row" title="Informe a quantidade de jogos que deseja gerar para este tipo">
                        <span class="prefix">Qtd</span>
                        <input type="number" id="qty-${g.slug}" min="0" data-cost="${cost}" placeholder="0" style="text-align: center;">
                    </div>
                </div>
            `;
        }).join('');
        
        activeGames.forEach(g => {
            const el = $('qty-'+g.slug);
            if(el) el.addEventListener('input', updateSummary);
        });
    }

    const summaryBar = $('summary-bar');
    if (summaryBar) {
        summaryBar.innerHTML = activeGames.map(g => `<div class="summary-item"><span>${g.nome}</span><strong id="s-${g.slug}-qty">0 jogos</strong></div>`).join('') +
            `<div class="summary-item"><span>Total</span><strong id="s-total">R$ 0,00</strong></div>`;
    }

    const tabsContainer = $('dynamic-tabs');
    const contentsContainer = $('dynamic-tab-contents');
    if (tabsContainer && contentsContainer) {
        tabsContainer.innerHTML = activeGames.map((g, idx) => `
            <button class="tab ${idx === 0 ? 'active' : ''}" data-tab="tab-${g.slug}">${g.nome}</button>
        `).join('');
        
        contentsContainer.innerHTML = activeGames.map((g, idx) => {
            const p = g.parametros || {};
            return `
                <div id="tab-${g.slug}" class="tab-content ${idx === 0 ? 'active' : ''}">
                    <div class="tab-toolbar">
                        <span class="tab-info">${p.pick_size||0} dezenas · 1 a ${p.range_max||0}</span>
                        <button class="btn-sm" id="btn-copy-${g.slug}">Copiar todos</button>
                    </div>
                    <div class="games-list" id="${g.slug}-games"></div>
                </div>
            `;
        }).join('');

        $$('#dynamic-tabs .tab').forEach(t => {
            t.addEventListener('click', (e) => {
                $$('#dynamic-tabs .tab').forEach(x => x.classList.remove('active'));
                $$('#dynamic-tab-contents .tab-content').forEach(x => x.classList.remove('active'));
                e.target.classList.add('active');
                $(e.target.dataset.tab).classList.add('active');
            });
        });

        activeGames.forEach(g => {
            const btn = $('btn-copy-'+g.slug);
            if(btn) {
                btn.addEventListener('click', () => {
                    const state = currentGamesData[g.slug];
                    if(!state || !state.games) return;
                    const data = state.games.map(arr => arr.map(n => pad(n)).join(' ')).join('\n');
                    if(data) {
                        navigator.clipboard.writeText(data);
                        toast('Jogos copiados!');
                    }
                });
            }
        });
    }

    const finBetType = $('fin-bet-type');
    const finPrizeType = $('fin-prize-type');
    const finFilters = $('fin-filters-container');
    
    const options = activeGames.map(g => `<option value="${g.slug}">${g.nome}</option>`).join('');
    if (finBetType) finBetType.innerHTML = options;
    if (finPrizeType) finPrizeType.innerHTML = options;
    
    if (finFilters) {
        finFilters.innerHTML = `
            <button class="fin-filter active" data-filter="all">Todos</button>
            <button class="fin-filter" data-filter="bet">Gastos</button>
            <button class="fin-filter" data-filter="prize">Prêmios</button>
            ${activeGames.map(g => `<button class="fin-filter" data-filter="${g.slug}">${g.nome}</button>`).join('')}
        `;
        $$('.fin-filter').forEach(btn => btn.addEventListener('click', (e) => {
            $$('.fin-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            window.currentFinFilter = e.target.dataset.filter;
            if(typeof refreshFinancialData === 'function') refreshFinancialData();
        }));
    }

    updateSummary();
}

function updateSummary() {
    let totalCost = 0;
    const qtys = {};
    activeGames.forEach(g => {
        const el = $('qty-'+g.slug);
        const qty = parseInt(el?.value) || 0;
        qtys[g.slug] = qty;
        const cost = parseFloat(el?.dataset.cost) || 0;
        totalCost += qty * cost;
        const sel = $('s-'+g.slug+'-qty');
        if(sel) sel.textContent = qty + ' jogos';
    });
    const stot = $('s-total');
    if(stot) stot.textContent = fmt(totalCost);
    return qtys;
}


async function generateAll() {
    const qtys = updateSummary();
    const totalQty = Object.values(qtys).reduce((a,b)=>a+b, 0);
    if (totalQty === 0) { toast('Selecione a quantidade de jogos'); return; }

    const btn = $('btn-generate');
    if(!btn) return;
    btn.classList.add('loading');
    btn.textContent = 'Gerando...';

    // Get selected strategy from radio buttons
    const strategyRadio = document.querySelector('input[name="strategy"]:checked');
    const strategyName = strategyRadio ? strategyRadio.value : 'statistical';
    
    try {
        let hasSelections = false;
        for (const g of activeGames) {
            const qty = qtys[g.slug] || 0;
            const state = currentGamesData[g.slug];
            if(!state) continue;

            // Fetch history if the strategy requires it (e.g. frequent, delayed)
            let history = [];
            if (strategyName !== 'statistical') {
                history = await historyManager.getHistory(g.slug);
            }

            const kept = state.games.filter((_, i) => state.selected.has(i));
            const needed = qty - kept.length;
            
            let newGames = [];
            if (needed > 0) {
                newGames = strategyEngine.run(strategyName, needed, g.parametros, history, kept);
            }
            
            state.games = [...kept, ...newGames];
            state.page = 0;
            if(state.selected.size > 0) hasSelections = true;
            state.selected.clear();
        }

        renderGames();

        const resArea = $('results-area');
        if(resArea) {
            resArea.classList.remove('hidden');
        }

        saveToHistory();
        if (!hasSelections) toast('Jogos gerados e salvos no histórico!', 'success', 'top-right');
        else toast('Jogos complementados e salvos!', 'success', 'top-right');

        // Exibe os botões de ação e controle da fila
        $('btn-register-bet-gen')?.classList.remove('hidden');
        $('btn-automation-gen')?.classList.remove('hidden');
        $('btn-clear-queue-gen')?.classList.remove('hidden');
    } catch (e) {
        console.error("Error generating games:", e);
        toast('Erro ao gerar: ' + e.message);
    } finally {
        btn.classList.remove('loading');
        btn.textContent = 'Gerar Jogos';
    }
}

function renderGames() {
    activeGames.forEach(g => {
        const state = currentGamesData[g.slug];
        const container = $(g.slug + '-games');
        if(!container || !state) return;
        
        const itemsPerPage = 6;
        const totalItems = state.games.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (state.page === undefined) state.page = 0;
        if (state.page >= totalPages && totalPages > 0) {
            state.page = totalPages - 1;
        }
        if (state.page < 0) state.page = 0;

        const startIdx = state.page * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const paginatedGames = state.games.slice(startIdx, endIdx);

        let html = paginatedGames.map((game, relativeIdx) => {
            const idx = startIdx + relativeIdx;
            const sel = state.selected.has(idx);
            const stats = metricsCalculator.calculate(game, g.parametros);
            return `
            <div class="game-card ${sel ? 'selected' : ''}" data-slug="${g.slug}" data-idx="${idx}">
                <div class="game-top" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span class="game-label" style="margin-bottom: 0;">Jogo ${pad(idx + 1)}</span>
                    <div class="game-meta" style="margin-right: 0;">
                        <span class="game-stat" title="Distribuição: Pares e Ímpares (Quantidade de números pares / Quantidade de números ímpares)">P/I: <strong>${stats.evens}/${stats.odds}</strong></span>
                        <span class="game-stat" title="Soma total de todas as dezenas deste jogo">Soma: <strong>${stats.sum}</strong></span>
                        <span class="game-stat" title="Maior sequência de dezenas consecutivas (Ex: 12, 13, 14 = 3)">Seq Máx: <strong>${stats.consec}</strong></span>
                        <span class="game-stat" title="Distribuição por faixas de dezenas (ex: dezenas na casa de 0-9, 10-19, etc.)">Faixas: <strong>${stats.rStr}</strong></span>
                        <span class="game-stat" title="Média dos intervalos/gaps de distância entre as dezenas">Gap Méd: <strong>${stats.avgG}</strong></span>
                    </div>
                    <div class="game-actions">
                        <button class="btn-icon btn-copy-one" title="Copiar este jogo para a área de transferência" data-slug="${g.slug}" data-idx="${idx}">${ICON.copy}</button>
                        <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Fixar / Manter este jogo na próxima geração" data-slug="${g.slug}" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
                    </div>
                </div>
                <div class="game-numbers" style="margin-top: 12px; margin-bottom: 12px;">${game.map(n => renderBall(n, g.slug)).join('')}</div>
                <div class="score-row" title="Score geral de qualidade baseado no balanço estatístico">
                    <span class="score-tag ${stats.sClass}">${stats.sLabel}</span>
                    <div class="score-bar-wrap"><div class="score-bar" style="width:${stats.score}%"></div></div>
                    <span class="score-label ${stats.sClass}">${stats.score}/100</span>
                </div>
            </div>`;
        }).join('');

        if (totalPages > 1) {
            html += `
            <div class="pagination-control" style="display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 20px; padding: 10px 0;">
                <button class="btn-sm prev-page-btn" data-slug="${g.slug}" ${state.page === 0 ? 'disabled' : ''}>Anterior</button>
                <span style="font-size: 0.85rem; color: var(--text-2);">Página <strong>${state.page + 1}</strong> de <strong>${totalPages}</strong></span>
                <button class="btn-sm next-page-btn" data-slug="${g.slug}" ${state.page === totalPages - 1 ? 'disabled' : ''}>Próxima</button>
            </div>
            `;
        }

        container.innerHTML = html;
    });

    $$('.prev-page-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const slug = e.currentTarget.dataset.slug;
            if (currentGamesData[slug].page > 0) {
                currentGamesData[slug].page--;
                renderGames();
            }
        });
    });

    $$('.next-page-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const slug = e.currentTarget.dataset.slug;
            const itemsPerPage = 6;
            const totalPages = Math.ceil(currentGamesData[slug].games.length / itemsPerPage);
            if (currentGamesData[slug].page < totalPages - 1) {
                currentGamesData[slug].page++;
                renderGames();
            }
        });
    });

    $$('.btn-select').forEach(b => {
        b.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const slug = btn.dataset.slug;
            const idx = parseInt(btn.dataset.idx);
            const state = currentGamesData[slug];
            if(!state) return;
            if(state.selected.has(idx)) state.selected.delete(idx);
            else state.selected.add(idx);
            renderGames();
        });
    });

    $$('.btn-copy-one').forEach(b => {
        b.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const slug = btn.dataset.slug;
            const idx = parseInt(btn.dataset.idx);
            const game = currentGamesData[slug].games[idx];
            navigator.clipboard.writeText(game.map(n=>pad(n)).join(' '));
            toast('Jogo copiado!');
        });
    });

    renderAnalysis();
}
function renderAnalysis() {
    const ab = $('analysis-body');
    if (!ab) return;
    
    let h = '';
    
    // Mode badge
    h += `<div class="analysis-section" style="margin-bottom: 16px;"><p style="font-size:.8rem;color:var(--text-2);margin-bottom:8px">
        Modo de Geração: <strong style="color:var(--gold)">${MODES[generationMode]?.label || 'Dinâmico'}</strong></p></div>`;

    let hasData = false;
    activeGames.forEach(g => {
        const state = currentGamesData[g.slug];
        if (!state || state.games.length === 0) return;
        hasData = true;

        const maxDezenas = parseInt(g.dezenas_range) || 60; // default to 60 if not specified
        
        const freq = {};
        for (let i = 1; i <= maxDezenas; i++) freq[i] = 0;
        state.games.forEach(game => game.forEach(n => {
            if (freq[n] !== undefined) freq[n]++;
        }));

        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const bot5 = sorted.slice(-5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const avgEv = (state.games.reduce((s, game) => s + countEven(game), 0) / state.games.length).toFixed(1);
        const avgMaxSeq = (state.games.reduce((s, game) => s + maxConsec(game), 0) / state.games.length).toFixed(1);

        h += `
        <div class="analysis-section" style="margin-bottom: 24px;">
            <h4 style="color: var(--gold); margin-bottom: 12px; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                <span style="display:inline-block;width:4px;height:14px;background:var(--gold);border-radius:2px;"></span>
                ${g.nome} — Análise
            </h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: var(--text-2); display: flex; flex-direction: column; gap: 8px;">
                <li><strong style="color: var(--text);">Mais frequentes:</strong> ${top5}</li>
                <li><strong style="color: var(--text);">Menos frequentes:</strong> ${bot5}</li>
                <li><strong style="color: var(--text);">Média de pares/jogo:</strong> ${avgEv}</li>
                <li><strong style="color: var(--text);">Máx. consecutivos (Média):</strong> ${avgMaxSeq}</li>
            </ul>
        </div>`;
    });

    if (!hasData) {
        h = '<p style="color: var(--text-3); font-size: 0.9rem; text-align: center; padding: 20px 0;">Gere jogos para ver a análise estatística dinâmica.</p>';
    }

    ab.innerHTML = h;
}

// ===== HISTORY (localStorage) =====
const HISTORY_KEY = 'lotosmart_history';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}
function saveHistoryData(data) { localStorage.setItem(HISTORY_KEY, JSON.stringify(data)); }

function saveToHistory() {
    const history = loadHistory();
    const entry = {
        id: Date.now(),
        date: new Date().toLocaleString('pt-BR'),
        gamesData: {}
    };
    
    activeGames.forEach(g => {
        if(currentGamesData[g.slug]) {
            entry.gamesData[g.slug] = currentGamesData[g.slug].games;
        }
    });

    history.unshift(entry);
    if (history.length > 50) history.length = 50;
    saveHistoryData(history);
    renderHistory();
}

function deleteHistoryEntry(id) {
    const history = loadHistory().filter(h => h.id !== id);
    saveHistoryData(history);
    renderHistory();
}

function clearHistory() {
    showConfirm('Limpar Histórico', 'Deseja realmente apagar todo o histórico de jogos gerados localmente?', () => {
        saveHistoryData([]);
        renderHistory();
        toast('Histórico limpo!', 'success');
    });
}

function loadFromHistory(entry) {
    activeGames.forEach(g => {
        if(entry.gamesData[g.slug]) {
            currentGamesData[g.slug] = {
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

function renderHistory() {
    const history = loadHistory();
    const el = $('history-list');
    const empty = $('history-empty');

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
                <span class="history-summary">${Object.keys(h.gamesData).length} jogos salvos</span>
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
        hdr.addEventListener('click', () => hdr.nextElementSibling.classList.toggle('open'));
    });
    $$('.btn-load-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            const entry = loadHistory().find(h => h.id === id);
            if (entry) loadFromHistory(entry);
        });
    });
    $$('.btn-del-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            showConfirm(
                'Excluir Histórico',
                'Deseja realmente excluir este lote de jogos do histórico?',
                () => {
                    deleteHistoryEntry(id);
                    toast('Lote excluído!', 'success');
                }
            );
        });
    });
}

// ===== TOAST =====
function toast(msg, type = 'info', pos = 'bottom') {
    const el = $('toast');
    if(!el) return;
    el.className = 'toast'; // Reset classes
    if (type === 'success') el.classList.add('success');
    if (pos === 'top-right') el.classList.add('top-right');
    $('toast-msg').textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
}
window.toast = toast;

// ===== PREMIUM CONFIRM DIALOG =====
function showConfirm(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center; border-color: var(--border-active);">
            <div class="modal-header" style="justify-content: center; margin-bottom: 14px;">
                <h2 style="font-size: 1.2rem; color: var(--gold); margin: 0;">${title}</h2>
            </div>
            <p style="color: var(--text-2); font-size: 0.85rem; margin-bottom: 24px; line-height: 1.5; white-space: pre-line;">
                ${message}
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="confirm-cancel-btn" class="btn-secondary" style="margin: 0; padding: 10px 20px; flex: 1;">Cancelar</button>
                <button id="confirm-ok-btn" class="btn-primary" style="margin: 0; padding: 10px 20px; flex: 1;">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.opacity = '1', 20);

    const cleanup = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector('#confirm-cancel-btn').onclick = cleanup;
    overlay.querySelector('#confirm-ok-btn').onclick = () => {
        cleanup();
        onConfirm();
    };
}
window.showConfirm = showConfirm;

function switchView(view) {
    const isValid = !!currentSession;
    const profile = currentProfile;

    if (!isValid) {
        if (view !== 'login' && view !== 'contato') {
            view = 'login';
        }
    } else if (profile && profile.must_change_password) {
        view = 'change-password';
    } else {
        if (view === 'login' || view === 'change-password') {
            view = 'gerador';
        } else if (view === 'admin' && !window.isSuperAdmin) {
            view = 'gerador';
        }
    }

    $$('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    const target = $('view-' + view);
    if (target) target.classList.remove('hidden');
    
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    
    if (view === 'admin' && window.isSuperAdmin && typeof window.refreshAdminData === 'function') {
        window.refreshAdminData();
    } else if (view === 'historico') {
        renderHistory();
    } else if (view === 'financeiro') {
        refreshFinancialData();
    }
}

// ===== TABS =====
function switchTab(tabId) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    $$('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === tabId));
}

// ===== MODE SWITCHING =====
function setMode(mode) {
    generationMode = mode;
    updateModeUI();
}

function updateModeUI() {
    $$('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === generationMode);
    });
}

// ===== SUPABASE INITIALIZATION =====
const SUPABASE_URL = 'https://klrivylidketfbaakbil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtscml2eWxpZGtldGZiYWFrYmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDg3MTEsImV4cCI6MjA5NTM4NDcxMX0.hM-wBFJV8mUlUj1G0QhDtBrJ4Xcb0L4HBel0dR0bi7s';
let supabaseClient = null;
let sbReady = false;
let currentSession = null;
let currentProfile = null;

async function initSupabase() {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
        sbReady = true;
        window.sbReady = true;
        console.log('Supabase initialized successfully');
        return true;
    } catch (e) {
        console.warn('Supabase not available:', e.message);
        sbReady = false;
        window.sbReady = false;
    }
    return false;
}

// Deprecated local setup method
async function ensureCollections() {
    return true;
}

// ===== AUTHENTICATION MODULE =====
async function loginUser(email, password) {
    if (!sbReady) return { success: false, message: 'Supabase não inicializado' };
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
            await supabaseClient.from('profiles').update({
                ultimo_login: new Date().toISOString()
            }).eq('id', data.user.id);
            
            await logAudit('login', data.user.id, { email });
            await checkAuthState();
            return { success: true };
        }
    } catch (e) {
        console.error('Login error:', e);
        return { success: false, message: e.message || 'E-mail ou senha incorretos' };
    }
    return { success: false, message: 'Credenciais inválidas' };
}

async function logoutUser() {
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await logAudit('logout', session.user.id, {});
        }
        await supabaseClient.auth.signOut();
    }
    currentSession = null;
    currentProfile = null;
    await checkAuthState();
}

async function changePassword(oldPass, newPass) {
    if (!supabaseClient) return { success: false, message: 'Não autenticado' };
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) throw error;

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await supabaseClient.from('profiles').update({
                must_change_password: false
            }).eq('id', session.user.id);
            await logAudit('password_change', session.user.id, {});
        }
        await checkAuthState();
        return { success: true };
    } catch (e) {
        console.error('Password change error:', e);
        return { success: false, message: e.message || 'Erro ao alterar a senha' };
    }
}

// Navigation Guards
let isAuthChecking = false;
async function checkAuthState() {
    if (isAuthChecking) return;
    isAuthChecking = true;

    try {
        if (!sbReady) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        currentSession = session;
        window.currentSession = session;
        currentProfile = null;
        window.currentProfile = null;

        if (session) {
            const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
            if (!error && profile) {
                currentProfile = profile;
                window.currentProfile = profile;
            }
            
            // Verifica se é super admin usando a RPC
            const { data: isSuper } = await supabaseClient.rpc('is_super_admin', { _user_id: session.user.id });
            window.isSuperAdmin = !!isSuper;
        } else {
            window.isSuperAdmin = false;
        }

        const user = currentSession ? currentSession.user : null;
        const profile = currentProfile;

        if (profile && profile.ativo === false) {
            await supabaseClient.auth.signOut();
            currentSession = null;
            window.currentSession = null;
            currentProfile = null;
            window.currentProfile = null;
            window.isSuperAdmin = false;
            toast('Sua conta foi desativada pelo administrador.');
            await checkAuthState();
            isAuthChecking = false;
            return;
        }

        const navGerador = $('nav-btn-gerador');
        const navHistorico = $('nav-btn-historico');
        const navFinanceiro = $('nav-btn-financeiro');
        const navAdmin = $('nav-btn-admin');
        const navContato = $('nav-btn-contato');
        const userMenu = $('user-menu');
        const headerUserName = $('header-user-name');

        if (!currentSession) {
            window.currentSession = null;
            if(navGerador) navGerador.style.display = 'none';
            if(navHistorico) navHistorico.style.display = 'none';
            if(navFinanceiro) navFinanceiro.style.display = 'none';
            if(navAdmin) navAdmin.style.display = 'none';
            if(userMenu) userMenu.style.display = 'none';
            activeGames = [];
            currentGamesData = {};
            const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
            if (!currentView || (currentView.id !== 'view-login' && currentView.id !== 'view-contato')) {
                switchView('login');
            }
        } else {
            if(userMenu) userMenu.style.display = 'flex';
            if(headerUserName) headerUserName.textContent = (profile && profile.name) || user.email;

            if (profile && profile.must_change_password) {
                if(navGerador) navGerador.style.display = 'none';
                if(navHistorico) navHistorico.style.display = 'none';
                if(navFinanceiro) navFinanceiro.style.display = 'none';
                if(navAdmin) navAdmin.style.display = 'none';
                switchView('change-password');
            } else {
                if(navGerador) navGerador.style.display = 'inline-block';
                if(navHistorico) navHistorico.style.display = 'inline-block';
                if(navFinanceiro) navFinanceiro.style.display = 'inline-block';
                
                if (window.isSuperAdmin) {
                    if(navAdmin) {
                        navAdmin.style.display = 'inline-block';
                        navAdmin.classList.remove('hidden');
                    }
                } else {
                    if(navAdmin) {
                        navAdmin.style.display = 'none';
                        navAdmin.classList.add('hidden');
                    }
                }

                await loadAvailableGames();
                const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
                if (!currentView || currentView.id === 'view-login' || currentView.id === 'view-change-password') {
                    switchView('gerador');
                } else if (currentView.id === 'view-admin' && !window.isSuperAdmin) {
                    switchView('gerador');
                }
            }
        }
    } finally {
        isAuthChecking = false;
    }
}

// ===== AUDIT LOGS =====
async function logAudit(action, targetId = '', details = {}) {
    if (!sbReady || !currentSession) return;
    try {
        await supabaseClient.from('audit_logs').insert({
            action,
            user_id: currentSession.user.id,
            target_id: targetId,
            details: details
        });
    } catch (e) {
        console.error('Audit log failed:', e);
    }
}
window.logAudit = logAudit;



// ===== FINANCIAL DATA — LOCALSTORAGE FALLBACK =====
const FIN_BETS_KEY = 'lotosmart_bets';
const FIN_PRIZES_KEY = 'lotosmart_prizes';

function loadLocalBets() {
    try { return JSON.parse(localStorage.getItem(FIN_BETS_KEY)) || []; }
    catch { return []; }
}
function saveLocalBets(data) { localStorage.setItem(FIN_BETS_KEY, JSON.stringify(data)); }

function loadLocalPrizes() {
    try { return JSON.parse(localStorage.getItem(FIN_PRIZES_KEY)) || []; }
    catch { return []; }
}
function saveLocalPrizes(data) { localStorage.setItem(FIN_PRIZES_KEY, JSON.stringify(data)); }

// ===== FINANCIAL CRUD =====
async function addBet(betData) {
    let insertedBet = null;
    if (sbReady && currentSession) {
        try {
            const dataWithOwner = { ...betData, owner_id: currentSession.user.id };
            const { data, error } = await supabaseClient.from('bets').insert(dataWithOwner).select();
            if (error) throw error;
            insertedBet = data?.[0];
        } catch (e) {
            console.error('Supabase create bet failed, using localStorage:', e);
            const bets = loadLocalBets();
            insertedBet = { ...betData, id: Date.now().toString(), created: new Date().toISOString() };
            bets.unshift(insertedBet);
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets();
        insertedBet = { ...betData, id: Date.now().toString(), created: new Date().toISOString() };
        bets.unshift(insertedBet);
        saveLocalBets(bets);
    }
    await refreshFinancialData();
    return insertedBet;
}

async function addPrize(prizeData) {
    if (sbReady && currentSession) {
        try {
            const dataWithOwner = { ...prizeData, owner_id: currentSession.user.id };
            const { error } = await supabaseClient.from('prizes').insert(dataWithOwner);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase create prize failed, using localStorage:', e);
            const prizes = loadLocalPrizes();
            prizes.unshift({ ...prizeData, id: Date.now().toString(), created: new Date().toISOString() });
            saveLocalPrizes(prizes);
        }
    } else {
        const prizes = loadLocalPrizes();
        prizes.unshift({ ...prizeData, id: Date.now().toString(), created: new Date().toISOString() });
        saveLocalPrizes(prizes);
    }
    await refreshFinancialData();
}

async function deleteBet(id) {
    if (sbReady && currentSession) {
        try {
            const { error } = await supabaseClient.from('bets').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase delete bet failed:', e);
            const bets = loadLocalBets().filter(b => b.id !== id);
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets().filter(b => b.id !== id);
        saveLocalBets(bets);
    }
    await refreshFinancialData();
}

async function deletePrize(id) {
    if (sbReady && currentSession) {
        try {
            const { error } = await supabaseClient.from('prizes').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase delete prize failed:', e);
            const prizes = loadLocalPrizes().filter(p => p.id !== id);
            saveLocalPrizes(prizes);
        }
    } else {
        const prizes = loadLocalPrizes().filter(p => p.id !== id);
        saveLocalPrizes(prizes);
    }
    await refreshFinancialData();
}

async function getAllBets() {
    if (sbReady && currentSession) {
        try {
            const { data, error } = await supabaseClient.from('bets').select('*').order('bet_date', { ascending: false });
            if (error) throw error;
            return data;
        } catch (e) {
            console.error('Supabase get bets failed:', e);
            return loadLocalBets();
        }
    }
    return loadLocalBets();
}

async function getAllPrizes() {
    if (sbReady && currentSession) {
        try {
            const { data, error } = await supabaseClient.from('prizes').select('*').order('prize_date', { ascending: false });
            if (error) throw error;
            return data;
        } catch (e) {
            console.error('Supabase get prizes failed:', e);
            return loadLocalPrizes();
        }
    }
    return loadLocalPrizes();
}


// ===== FINANCIAL STATE =====
let allBets = [];
let allPrizes = [];
let finFilter = 'all';
let finChart = null;

async function refreshFinancialData() {
    allBets = await getAllBets();
    allPrizes = await getAllPrizes();
    renderFinancialDashboard();
    renderTransactions();
    renderFinancialChart();
}

// ===== FINANCIAL DASHBOARD =====
function renderFinancialDashboard() {
    const totalSpent = allBets.reduce((s, b) => s + (parseFloat(b.total_cost) || 0), 0);
    const totalWon = allPrizes.reduce((s, p) => s + (parseFloat(p.prize_amount) || 0), 0);
    const pl = totalWon - totalSpent;
    const roi = totalSpent > 0 ? ((totalWon / totalSpent) * 100 - 100) : 0;

    // Count unique weeks
    const weekSet = new Set();
    allBets.forEach(b => {
        if (b.bet_date) {
            const d = new Date(b.bet_date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            weekSet.add(weekStart.toISOString().slice(0, 10));
        }
    });

    // Hit rate: % of bets that have matching prizes
    const betsWithPrize = allPrizes.length;
    const totalBetEntries = allBets.length;
    const hitRate = totalBetEntries > 0 ? ((betsWithPrize / totalBetEntries) * 100) : 0;

    $('fin-total-spent').textContent = fmt(totalSpent);
    $('fin-total-spent').className = 'metric-value' + (totalSpent > 0 ? ' negative' : '');
    $('fin-spent-detail').textContent = `${allBets.length} aposta${allBets.length !== 1 ? 's' : ''} registrada${allBets.length !== 1 ? 's' : ''}`;

    $('fin-total-won').textContent = fmt(totalWon);
    $('fin-total-won').className = 'metric-value' + (totalWon > 0 ? ' positive' : '');
    $('fin-won-detail').textContent = `${allPrizes.length} prêmio${allPrizes.length !== 1 ? 's' : ''} registrado${allPrizes.length !== 1 ? 's' : ''}`;

    $('fin-pl').textContent = (pl >= 0 ? '+' : '') + fmt(pl);
    $('fin-pl').className = 'metric-value ' + (pl >= 0 ? 'positive' : 'negative');
    $('fin-pl-detail').textContent = pl >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado';

    $('fin-roi').textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%';
    $('fin-roi').className = 'metric-value ' + (roi >= 0 ? 'positive' : 'negative');

    $('fin-hit-rate').textContent = hitRate.toFixed(1) + '%';
    $('fin-rate-detail').textContent = `${betsWithPrize} de ${totalBetEntries} apostas premiadas`;

    $('fin-weeks').textContent = weekSet.size;
    $('fin-weeks-detail').textContent = weekSet.size > 0 ? `desde ${[...weekSet].sort()[0].split('-').reverse().join('/')}` : '—';
}

// ===== TRANSACTION TABLE =====
function renderTransactions() {
    // Combine bets and prizes into a single list
    const transactions = [];

    allBets.forEach(b => {
        transactions.push({
            id: b.id,
            type: 'bet',
            date: b.bet_date,
            lottery: b.lottery_type,
            details: `${b.game_count || 1} jogo${(b.game_count || 1) > 1 ? 's' : ''}` + (b.contest_number ? ` · Conc. ${b.contest_number}` : '') + (b.notes ? ` · ${b.notes}` : ''),
            amount: -(parseFloat(b.total_cost) || 0),
            source: 'bets'
        });
    });

    allPrizes.forEach(p => {
        transactions.push({
            id: p.id,
            type: 'prize',
            date: p.prize_date,
            lottery: p.lottery_type,
            details: `${p.matches || 0} acertos` + (p.contest_number ? ` · Conc. ${p.contest_number}` : '') + (p.notes ? ` · ${p.notes}` : ''),
            amount: parseFloat(p.prize_amount) || 0,
            source: 'prizes'
        });
    });

    // Sort by date descending
    transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Apply filter
    const filtered = transactions.filter(t => {
        if (finFilter === 'all') return true;
        if (finFilter === 'bet') return t.type === 'bet';
        if (finFilter === 'prize') return t.type === 'prize';
        if (finFilter === 'lf') return t.lottery === 'lf';
            if (finFilter === 'qn') return t.lottery === 'qn';
        return true;
    });

    const tbody = $('fin-table-body');
    
    // Header and wrappers
    const header = $('fin-history-header');
    const tableWrap = document.querySelector('.fin-table-wrap');
    const emptyState = $('fin-table-empty');

    if (transactions.length === 0) {
        if(header) header.style.display = 'none';
        if(tableWrap) tableWrap.style.display = 'none';
        if(emptyState) emptyState.style.display = 'block';
        tbody.innerHTML = '';
        return;
    } else {
        if(header) header.style.display = 'flex';
        if(tableWrap) tableWrap.style.display = 'block';
        if(emptyState) emptyState.style.display = 'none';
    }

    tbody.innerHTML = filtered.map(t => {
        const dateStr = t.date ? t.date.split('-').reverse().join('/') : '—';
        const lotteryLabel = t.lottery === 'lf' ? 'Lotofácil' : t.lottery === 'qn' ? 'Quina' : '—';
        const amountClass = t.amount >= 0 ? 'amount-positive' : 'amount-negative';
        const amountStr = (t.amount >= 0 ? '+' : '') + fmt(Math.abs(t.amount));
        const typeBadge = t.type === 'bet'
            ? '<span class="type-badge badge-bet">Gasto</span>'
            : '<span class="type-badge badge-prize">Prêmio</span>';

        return `<tr>
            <td>${dateStr}</td>
            <td>${typeBadge}</td>
            <td>${lotteryLabel}</td>
            <td>${t.details}</td>
            <td class="amount-cell ${amountClass}">${amountStr}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-table-action btn-del-transaction" title="Excluir" data-id="${t.id}" data-source="${t.source}">${ICON.trash}</button>
            </td>
        </tr>`;
    }).join('');

    // Bind delete buttons
    tbody.querySelectorAll('.btn-del-transaction').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const source = btn.dataset.source;
            showConfirm(
                'Excluir Transação',
                'Deseja realmente excluir esta transação do financeiro? Esta ação não pode ser desfeita.',
                async () => {
                    if (source === 'bets') await deleteBet(id);
                    else await deletePrize(id);
                }
            );
        });
    });
}

// ===== DELETE ICON =====
// (moved to global ICON object)

// ===== FINANCIAL CHART =====
function renderFinancialChart() {
    const chartContainer = $('fin-chart-container');
    
    if (allBets.length === 0 && allPrizes.length === 0) {
        if(chartContainer) chartContainer.style.display = 'none';
        return;
    } else {
        if(chartContainer) chartContainer.style.display = 'block';
    }

    const canvasEl = $('fin-chart');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    
    // Combine all transactions and sort by date
    const allTransactions = [];
    allBets.forEach(b => allTransactions.push({
        date: b.bet_date, amount: -(parseFloat(b.total_cost) || 0)
    }));
    allPrizes.forEach(p => allTransactions.push({
        date: p.prize_date, amount: parseFloat(p.prize_amount) || 0
    }));
    allTransactions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (allTransactions.length === 0) {
        if (finChart) { finChart.destroy(); finChart = null; }
        return;
    }

    // Group by week
    const weeklyData = {};
    allTransactions.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        if (!weeklyData[key]) weeklyData[key] = { spent: 0, won: 0 };
        if (t.amount < 0) weeklyData[key].spent += Math.abs(t.amount);
        else weeklyData[key].won += t.amount;
    });

    const weeks = Object.keys(weeklyData).sort();
    const labels = weeks.map(w => {
        const d = w.split('-');
        return `${d[2]}/${d[1]}`;
    });

    // Cumulative P&L
    let cumPL = 0;
    const cumulativePL = weeks.map(w => {
        cumPL += weeklyData[w].won - weeklyData[w].spent;
        return cumPL;
    });

    const spentData = weeks.map(w => weeklyData[w].spent);
    const wonData = weeks.map(w => weeklyData[w].won);

    if (finChart) finChart.destroy();

    finChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Gastos',
                    data: spentData,
                    backgroundColor: 'rgba(232, 93, 93, 0.6)',
                    borderColor: 'rgba(232, 93, 93, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'Prêmios',
                    data: wonData,
                    backgroundColor: 'rgba(109, 213, 117, 0.6)',
                    borderColor: 'rgba(109, 213, 117, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'P&L Acumulado',
                    data: cumulativePL,
                    type: 'line',
                    borderColor: '#e8b44d',
                    backgroundColor: 'rgba(232, 180, 77, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#e8b44d',
                    pointBorderColor: '#0e1015',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#a0a5b8',
                        font: { family: "'Inter', sans-serif", size: 11 },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: '#191c24',
                    borderColor: '#353a4a',
                    borderWidth: 1,
                    titleColor: '#eaedf3',
                    bodyColor: '#a0a5b8',
                    titleFont: { family: "'Inter', sans-serif", weight: '600' },
                    bodyFont: { family: "'Outfit', sans-serif" },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => {
                            const val = ctx.parsed.y;
                            return ` ${ctx.dataset.label}: R$ ${Math.abs(val).toFixed(2).replace('.', ',')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#636880', font: { family: "'Outfit', sans-serif", size: 10 } },
                    grid: { color: 'rgba(39, 43, 56, 0.5)', drawBorder: false }
                },
                y: {
                    ticks: {
                        color: '#636880',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: v => 'R$' + v.toFixed(0)
                    },
                    grid: { color: 'rgba(39, 43, 56, 0.5)', drawBorder: false }
                }
            }
        }
    });
}

// ===== FINANCIAL FORM HANDLERS =====
function handleAddBet() {
    const betDate = $('fin-bet-date').value;
    const lotteryType = $('fin-bet-type').value;
    const gameCount = parseInt($('fin-bet-qty').value) || 1;
    const totalCost = parseFloat($('fin-bet-cost').value) || 0;
    const contestNumber = parseInt($('fin-bet-contest').value) || null;
    const notes = $('fin-bet-notes').value.trim();

    if (!betDate) { toast('Informe a data da aposta'); return; }
    if (totalCost <= 0) { toast('Informe o valor gasto'); return; }

    addBet({
        bet_date: betDate,
        lottery_type: lotteryType,
        game_count: gameCount,
        total_cost: totalCost,
        contest_number: contestNumber,
        notes: notes
    });

    // Reset form
    $('fin-bet-contest').value = '';
    $('fin-bet-notes').value = '';
    toast('💸 Gasto registrado com sucesso!');
}

function handleAddPrize() {
    const prizeDate = $('fin-prize-date').value;
    const lotteryType = $('fin-prize-type').value;
    const matches = parseInt($('fin-prize-matches').value) || 0;
    const prizeAmount = parseFloat($('fin-prize-amount').value) || 0;
    const contestNumber = parseInt($('fin-prize-contest').value) || null;
    const notes = $('fin-prize-notes').value.trim();

    if (!prizeDate) { toast('Informe a data do resultado'); return; }
    if (prizeAmount <= 0) { toast('Informe o valor do prêmio'); return; }

    addPrize({
        prize_date: prizeDate,
        lottery_type: lotteryType,
        matches: matches,
        prize_amount: prizeAmount,
        contest_number: contestNumber,
        notes: notes
    });

    // Reset form
    $('fin-prize-contest').value = '';
    $('fin-prize-notes').value = '';
    $('fin-prize-amount').value = '0';
    toast('🏆 Prêmio registrado com sucesso!');
}

// ===== REGISTER BET FROM GENERATOR =====
function registerBetFromGenerator() {
    const qtys = updateSummary();
    const today = new Date().toISOString().slice(0, 10);

    activeGames.forEach(g => {
        const qty = qtys[g.slug];
        if (qty > 0) {
            const cost = parseFloat($('qty-'+g.slug)?.dataset.cost) || 0;
            const total = qty * cost;
            const strategy = $('strategy-selector')?.value || 'statistical';
            addBet({
                bet_date: today,
                lottery_type: g.slug,
                game_count: qty,
                total_cost: total,
                contest_number: null,
                notes: `Gerado no LotoSmart`,
                games: currentGamesData[g.slug]?.games || [],
                generation_mode: strategy
            });
        }
    });

    toast('💰 Apostas registradas no financeiro!');
}

async function enqueueBetsForAutomation() {
    try {
        const btn = $('btn-automation-gen');
        if (btn) {
            btn.classList.add('loading');
            btn.textContent = 'Processando...';
        }

        const qtys = updateSummary();
        const today = new Date().toISOString().slice(0, 10);
        let enqueued = 0;

        for (const g of activeGames) {
            const qty = qtys[g.slug];
            if (qty > 0) {
                const el = $('qty-'+g.slug);
                const cost = el && el.dataset ? parseFloat(el.dataset.cost) : 0;
                const total = qty * (isNaN(cost) ? 0 : cost);
                const strategy = $('strategy-selector')?.value || 'statistical';
                const gamesArr = currentGamesData[g.slug]?.games || [];

                if (gamesArr.length === 0) continue;

                // 1. Cria a aposta (bet) com status de automação
                const betData = {
                    bet_date: today,
                    lottery_type: g.slug,
                    game_count: gamesArr.length,
                    total_cost: total,
                    contest_number: null,
                    notes: `Automacao LotoSmart`,
                    games: [],           // campo legado vazio — dados estao em bet_games
                    generation_mode: strategy,
                    automation_status: 'queued',
                    automation_requested_at: new Date().toISOString()
                };

                const insertedBet = await addBet(betData);

                if (!insertedBet || !insertedBet.id) {
                    toast('Erro ao criar a aposta no banco.');
                    continue;
                }

                // 2. Cria um bet_game por jogo gerado
                if (window.sbReady && window.currentSession) {
                    const betGamesPayload = gamesArr.map((numbers, idx) => ({
                        bet_id: insertedBet.id,
                        owner_id: window.currentSession.user.id,
                        lottery_type: g.slug,
                        numbers: numbers,
                        game_index: idx,
                        status: 'pendente'
                    }));

                    try {
                        const { error: bgErr } = await window.supabaseClient
                            .from('bet_games')
                            .insert(betGamesPayload);
                        if (bgErr) throw bgErr;
                    } catch (e) {
                        console.error('Erro ao criar bet_games:', e);
                        toast('Erro ao registrar jogos individuais: ' + e.message);
                    }

                    // 3. Enfileira na automation_queue
                    try {
                        const { error } = await window.supabaseClient
                            .from('automation_queue')
                            .insert({ bet_id: insertedBet.id, owner_id: window.currentSession.user.id, status: 'queued' });
                        if (error) throw error;
                        enqueued++;
                    } catch (e) {
                        console.error('Erro ao enfileirar:', e);
                        alert('Erro ao enviar para a fila de automacao: ' + e.message);
                    }
                }
            }
        }

        if (btn) {
            btn.classList.remove('loading');
            btn.textContent = 'Fazer Jogos';
        }

        if (enqueued > 0) {
            toast(`${enqueued} aposta(s) enviada(s) para fila! Acompanhe abaixo.`);
            // Atualiza o painel de pendentes
            await refreshPendingPanel();
        } else {
            toast('Nenhuma aposta enfileirada. Banco offline ou sem jogos gerados.');
        }
    } catch (err) {
        console.error('Erro fatal em enqueueBetsForAutomation:', err);
        alert('Erro no botao Fazer Jogos: ' + err.message);
        const btn = $('btn-automation-gen');
        if (btn) {
            btn.classList.remove('loading');
            btn.textContent = 'Fazer Jogos';
        }
    }
}

// ===== LIMPAR FILA DE AUTOMAÇÃO =====
async function clearAutomationQueue() {
    if (!sbReady || !currentSession) {
        toast('Você precisa estar conectado para limpar a fila.');
        return;
    }

    showConfirm(
        'Limpar Fila de Automação',
        'Limpar a fila cancela todos os jobs pendentes e em processamento.\nO robô vai parar de pegar novas tarefas.\n\nDeseja confirmar?',
        async () => {
            const btn = $('btn-clear-queue-gen');
            const btnPanel = $('btn-clear-queue-panel');
            [btn, btnPanel].forEach(b => { if (b) { b.disabled = true; b.textContent = 'Limpando...'; } });

            try {
                // 1. Remove todos os jobs da fila deste usuário
                const { error: qErr } = await supabaseClient
                    .from('automation_queue')
                    .delete()
                    .eq('owner_id', currentSession.user.id)
                    .in('status', ['queued', 'processing']);
                if (qErr) throw qErr;

                // 2. Reseta os bets para status 'none'
                const { error: bErr } = await supabaseClient
                    .from('bets')
                    .update({ automation_status: 'none' })
                    .eq('owner_id', currentSession.user.id)
                    .in('automation_status', ['queued', 'processing']);
                if (bErr) throw bErr;

                // 3. Reseta os bet_games pendentes para 'pendente' (cancelando processando)
                const { error: bgErr } = await supabaseClient
                    .from('bet_games')
                    .update({ status: 'pendente', error_message: 'Cancelado pelo usuário' })
                    .eq('owner_id', currentSession.user.id)
                    .eq('status', 'processando');
                if (bgErr) throw bgErr;

                toast('Fila limpa! O robô não processará mais nenhum job pendente.', 'success');
                await refreshPendingPanel();
            } catch (e) {
                console.error('Erro ao limpar fila:', e);
                toast('Erro ao limpar fila: ' + e.message);
            } finally {
                [btn, btnPanel].forEach(b => {
                    if (b) {
                        b.disabled = false;
                        b.textContent = b.id === 'btn-clear-queue-panel' ? 'Limpar Fila' : '🗑️ Limpar Fila';
                    }
                });
            }
        }
    );
}
window.clearAutomationQueue = clearAutomationQueue;

// ===== RESET TOTAL (HOMOLOGAÇÃO) =====
async function resetAllFinancialData() {
    if (!sbReady || !currentSession) {
        toast('Você precisa estar conectado.');
        return;
    }

    showConfirm(
        '⚠️ MODO HOMOLOGAÇÃO',
        'Isso vai apagar PERMANENTEMENTE:\n• Todas as apostas (bets)\n• Todos os prêmios (prizes)\n• Todos os jogos individuais (bet_games)\n• Toda a fila de automação\n• Todo o histórico local\n\nTem certeza absoluta?',
        async () => {
            const btn = $('btn-reset-all-data');
            if (btn) { btn.disabled = true; btn.textContent = 'Limpando...'; }

            const uid = currentSession.user.id;

            try {
                // 1. Fila de automação
                await supabaseClient.from('automation_queue')
                    .delete().eq('owner_id', uid);

                // 2. Jogos individuais
                await supabaseClient.from('bet_games')
                    .delete().eq('owner_id', uid);

                // 3. Apostas
                await supabaseClient.from('bets')
                    .delete().eq('owner_id', uid);

                // 4. Prêmios
                await supabaseClient.from('prizes')
                    .delete().eq('owner_id', uid);

                // 5. localStorage
                localStorage.removeItem('lotosmart_bets');
                localStorage.removeItem('lotosmart_prizes');
                localStorage.removeItem('lotosmart_history');

                toast('Todos os dados de teste foram apagados!', 'success');
                await refreshFinancialData();
                await refreshPendingPanel();

            } catch (e) {
                console.error('Erro ao resetar dados:', e);
                toast('Erro ao limpar: ' + (e.message || e));
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = '🗑️ Limpar todos os dados de teste'; }
            }
        }
    );
}
window.resetAllFinancialData = resetAllFinancialData;


// ===== PENDENTES DE LANCAMENTO (bet_games com status pendente_lancamento) =====


// Cache local dos bet_games em tempo real
window._betGamesCache = {};

const STATUS_LABELS = {
    pendente:             { label: 'Pendente',           cls: 'status-pendente' },
    processando:          { label: 'Processando...',     cls: 'status-processando' },
    sucesso:              { label: 'Registrado',         cls: 'status-sucesso' },
    erro:                 { label: 'Erro',               cls: 'status-erro' },
    pendente_lancamento:  { label: 'Aguard. Lancamento', cls: 'status-pendente-lancamento' },
    lancado:              { label: 'Lancado',            cls: 'status-lancado' },
};

function getStatusInfo(status) {
    return STATUS_LABELS[status] || { label: status, cls: '' };
}

async function refreshPendingPanel() {
    if (!sbReady || !currentSession) return;
    try {
        const { data, error } = await supabaseClient
            .from('bet_games')
            .select('*')
            .eq('owner_id', currentSession.user.id)
            .in('status', ['pendente', 'processando', 'pendente_lancamento'])
            .order('created_at', { ascending: false });
        if (error) throw error;
        // Atualiza o cache
        (data || []).forEach(bg => { window._betGamesCache[bg.id] = bg; });
        renderPendingPanel(data || []);
    } catch (e) {
        console.error('Erro ao carregar pendentes:', e);
    }
}

function renderPendingPanel(items) {
    const panel = $('pending-launch-panel');
    if (!panel) return;

    const pendLaunch = items.filter(i => i.status === 'pendente_lancamento');
    const inProgress = items.filter(i => ['pendente', 'processando'].includes(i.status));

    // Badge de contagem no nav/header
    const badge = $('pending-launch-badge');
    if (badge) {
        badge.textContent = pendLaunch.length;
        badge.classList.toggle('hidden', pendLaunch.length === 0);
    }

    if (items.length === 0) {
        panel.innerHTML = '<p class="fin-empty-state">Nenhum jogo aguardando lancamento.</p>';
        return;
    }

    const totalPend = pendLaunch.reduce((acc, bg) => {
        const g = activeGames.find(x => x.slug === bg.lottery_type);
        return acc + (g?.parametros?.cost || 3.00);
    }, 0);

    let html = '';

    // Resumo
    html += `<div class="pending-summary">
        <span>${pendLaunch.length} jogo(s) prontos p/ lancamento &mdash; <strong>${fmt(totalPend)}</strong></span>
        ${pendLaunch.length > 0 ? `<button class="btn-primary" id="btn-confirm-launch" style="margin-left:12px;padding:8px 16px;font-size:.82rem">Confirmar Lancamento Financeiro</button>` : ''}
    </div>`;

    // Processando
    if (inProgress.length > 0) {
        html += `<div class="pending-group"><p class="pending-group-title">Em andamento (${inProgress.length})</p>`;
        inProgress.forEach(bg => {
            const info = getStatusInfo(bg.status);
            const nums = (bg.numbers || []).map(n => pad(n)).join(', ');
            html += `<div class="pending-game-item">
                <span class="status-badge ${info.cls}">${info.label}</span>
                <span class="pending-lottery">${bg.lottery_type}</span>
                <span class="pending-numbers">${nums}</span>
            </div>`;
        });
        html += `</div>`;
    }

    // Prontos para lancamento
    if (pendLaunch.length > 0) {
        html += `<div class="pending-group"><p class="pending-group-title">Prontos para lancamento (${pendLaunch.length})</p>`;
        pendLaunch.forEach(bg => {
            const info = getStatusInfo(bg.status);
            const nums = (bg.numbers || []).map(n => pad(n)).join(', ');
            html += `<div class="pending-game-item" data-bgid="${bg.id}">
                <span class="status-badge ${info.cls}">${info.label}</span>
                <span class="pending-lottery">${bg.lottery_type}</span>
                <span class="pending-numbers">${nums}</span>
            </div>`;
        });
        html += `</div>`;
    }

    panel.innerHTML = html;

    // Handler do botao de confirmacao
    $('btn-confirm-launch')?.addEventListener('click', () => confirmFinancialLaunch(pendLaunch));
}

async function confirmFinancialLaunch(pendItems) {
    if (!pendItems || pendItems.length === 0) return;

    showConfirm(
        'Confirmar Lançamento Financeiro',
        `Deseja registrar o lançamento de ${pendItems.length} jogo(s) no módulo Financeiro? Isso debitará o custo contábil dos jogos do seu saldo.`,
        async () => {
            const today = new Date().toISOString().slice(0, 10);

            // Agrupa por bet_id para criar um unico registro financeiro por lote
            const grouped = {};
            pendItems.forEach(bg => {
                if (!grouped[bg.bet_id]) {
                    grouped[bg.bet_id] = { lottery_type: bg.lottery_type, games: [], ids: [] };
                }
                grouped[bg.bet_id].games.push(bg.numbers);
                grouped[bg.bet_id].ids.push(bg.id);
            });

            for (const [bet_id, grp] of Object.entries(grouped)) {
                const g = activeGames.find(x => x.slug === grp.lottery_type);
                const costUnit = g?.parametros?.cost || 3.00;
                const total = grp.games.length * costUnit;

                // Registra no financeiro
                await addBet({
                    bet_date: today,
                    lottery_type: grp.lottery_type,
                    game_count: grp.games.length,
                    total_cost: total,
                    notes: `Lancamento automatico via robo`,
                    games: grp.games,
                });

                // Marca os bet_games como lancados
                if (sbReady && currentSession) {
                    await supabaseClient
                        .from('bet_games')
                        .update({ status: 'lancado' })
                        .in('id', grp.ids);
                }
            }

            toast(`${pendItems.length} jogo(s) lancados no Financeiro!`, 'success');
            await refreshPendingPanel();
        }
    );
}

// ===== SUPABASE REALTIME: escuta bet_games =====
let _realtimeChannel = null;

function initBetGamesRealtime() {
    if (!sbReady || !currentSession || !supabaseClient) return;

    // Evita inscrição duplicada
    if (_realtimeChannel) {
        supabaseClient.removeChannel(_realtimeChannel);
        _realtimeChannel = null;
    }

    _realtimeChannel = supabaseClient
        .channel('bet_games_realtime')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'bet_games',
                filter: `owner_id=eq.${currentSession.user.id}`,
            },
            async (payload) => {
                console.log('[Realtime] bet_games update:', payload);
                const updated = payload.new;
                if (!updated) return;

                // Atualiza cache
                window._betGamesCache[updated.id] = updated;

                // Atualiza badge de status no card do jogo (se estiver visivel)
                const statusEl = document.querySelector(`[data-bgstatus="${updated.id}"]`);
                if (statusEl) {
                    const info = getStatusInfo(updated.status);
                    statusEl.className = `bet-game-status-badge ${info.cls}`;
                    statusEl.textContent = info.label;
                }

                // Recarrega o painel de pendentes quando um jogo muda de status relevante
                if (['pendente_lancamento', 'erro', 'sucesso'].includes(updated.status)) {
                    await refreshPendingPanel();
                }
            }
        )
        .subscribe();

    console.log('[Realtime] Inscrito em bet_games para owner_id =', currentSession.user.id);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    $('btn-generate')?.addEventListener('click', generateAll);
    $('btn-register-bet-gen')?.addEventListener('click', registerBetFromGenerator);
    $('btn-automation-gen')?.addEventListener('click', enqueueBetsForAutomation);
    $('btn-clear-queue-gen')?.addEventListener('click', clearAutomationQueue);
    $('btn-clear-history')?.addEventListener('click', clearHistory);
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // Mode selector
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Financial module
    $('btn-add-bet')?.addEventListener('click', handleAddBet);
    $('btn-add-prize')?.addEventListener('click', handleAddPrize);

    // Financial filters
    $$('.fin-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.fin-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            finFilter = btn.dataset.filter;
            renderTransactions();
        });
    });

    // Authentication UI Handlers
    $('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const btn = $('btn-login-submit');
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        const res = await loginUser(email, password);
        btn.disabled = false;
        btn.textContent = 'Entrar';
        if (res.success) {
            toast('Bem-vindo ao LotoSmart!');
        } else {
            toast(res.message);
        }
    });

    $('btn-logout')?.addEventListener('click', () => {
        logoutUser();
        toast('Sessão encerrada.');
    });

    $('form-change-password')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = $('change-old-password').value;
        const newPass = $('change-new-password').value;
        const confirmPass = $('change-confirm-password').value;
        const btn = $('btn-change-pass-submit');

        if (newPass.length < 8) {
            toast('A nova senha deve ter pelo menos 8 caracteres.');
            return;
        }
        if (newPass !== confirmPass) {
            toast('As senhas não coincidem.');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Alterando...';
        const res = await changePassword(oldPass, newPass);
        btn.disabled = false;
        btn.textContent = 'Alterar Senha';
        if (res.success) {
            toast('Senha alterada com sucesso!');
        } else {
            toast(res.message);
        }
    });

    $('form-contato')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('contact-name').value.trim();
        const email = $('contact-email').value.trim();
        const message = $('contact-message').value.trim();

        const subject = encodeURIComponent('Solicitação de Acesso LotoSmart');
        const body = encodeURIComponent(`Nome: ${name}\nE-mail: ${email}\nMensagem:\n${message}`);
        window.location.href = `mailto:contato@lotosmart.com?subject=${subject}&body=${body}`;
        
        toast('Direcionando para o e-mail...');
        $('form-contato').reset();
    });

    $('link-go-contato')?.addEventListener('click', (e) => { e.preventDefault(); switchView('contato'); });
    $('link-go-login')?.addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });

    // Set default dates to today
    const today = new Date().toISOString().slice(0, 10);
    if ($('fin-bet-date')) $('fin-bet-date').value = today;
    if ($('fin-prize-date')) $('fin-prize-date').value = today;

    updateSummary();
    updateModeUI();

    // Initialize Supabase, check session, then start Realtime
    initSupabase().then(async () => {
        await checkAuthState();
        if (currentSession && (!currentProfile || !currentProfile.must_change_password)) {
            refreshFinancialData();
            initBetGamesRealtime();    // Inicia escuta Realtime
            await refreshPendingPanel(); // Carrega pendentes salvos
        }
    });
});
