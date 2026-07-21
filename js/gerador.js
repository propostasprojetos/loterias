// ==========================================
// gerador.js - Generator UI and Logic
// ==========================================

import { supabaseClient } from './supabase.js';
import { state, MODES } from './store.js';
import { $, $$, pad, fmt, toast, renderBall, ICON, countEven, maxConsec } from './utils.js';
import { strategyEngine } from './engine/StrategyEngine.js';
import { historyManager } from './engine/HistoryManager.js';
import { metricsCalculator } from './engine/MetricsCalculator.js';
import { loadHistory, saveHistoryData } from './history.js';
import { refreshFinancialData, setFinFilter } from './financeiro.js';

export async function loadAvailableGames() {
    if (!state.currentProfile) return;
    try {
        const gamesPromise = supabaseClient.from('jogos').select('*').eq('status', 'ativo').order('ordem');
        let pjPromise = Promise.resolve({ data: [] });
        
        if (state.currentProfile.plano_id) {
            pjPromise = supabaseClient.from('plano_jogos').select('jogo_id').eq('plano_id', state.currentProfile.plano_id);
        }
        
        const [gamesRes, pjRes] = await Promise.all([gamesPromise, pjPromise]);
        const allGames = gamesRes.data;
        const planGameIds = (pjRes.data || []).map(p => p.jogo_id);
        
        const modulos = state.currentProfile.modulos_customizados || {};
        state.activeGames = (allGames || []).filter(g => {
            if (window.isSuperAdmin) return true;
            if (modulos[g.slug] !== undefined) return modulos[g.slug];
            return planGameIds.includes(g.id);
        });

        state.currentGamesData = {};
        state.activeGames.forEach(g => {
            state.currentGamesData[g.slug] = { games: [], selected: new Set(), page: 0 };
        });

        renderDynamicGameUI();
    } catch(e) { console.error('Erro ao carregar jogos:', e); }
}

export function renderDynamicGameUI() {
    const configGrid = $('config-grid');
    if (configGrid) {
        if (state.activeGames.length === 0) {
            configGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-2);">
                    <p style="margin-bottom: 10px;">Você não possui nenhum plano ou módulo de jogos ativo.</p>
                    <p style="font-size: 0.9em; opacity: 0.7;">Por favor, contate o administrador para liberar o seu acesso aos jogos.</p>
                </div>
            `;
            if ($('summary-bar')) $('summary-bar').innerHTML = '';
            if ($('dynamic-tabs')) $('dynamic-tabs').innerHTML = '';
            if ($('dynamic-tab-contents')) $('dynamic-tab-contents').innerHTML = '';
            return;
        }

        configGrid.innerHTML = state.activeGames.map(g => {
            const cost = g.parametros.cost || 3.00;
            const minSize = g.parametros.pick_size || 6;
            const maxSize = g.parametros.range_max || 60;
            return `
                <div class="field">
                    <label title="Configure os jogos para ${g.nome} (Custo base: R$ ${cost.toFixed(2)})">${g.nome}</label>
                    <div style="display:flex; gap:8px;">
                        <div class="input-row" title="Informe a quantidade de jogos que deseja gerar" style="flex:1;">
                            <span class="prefix" style="padding:0 6px;">Qtd</span>
                            <input type="number" id="qty-${g.slug}" min="0" data-cost="${cost}" placeholder="0" style="text-align: center; width:100%;">
                        </div>
                        <div class="input-row" title="Qtd de dezenas por jogo (Vazio = Padrão: ${minSize})" style="flex:1;">
                            <span class="prefix" style="padding:0 6px;">Dez</span>
                            <input type="number" id="size-${g.slug}" min="${minSize}" max="${maxSize}" placeholder="${minSize}" style="text-align: center; width:100%;">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        state.activeGames.forEach(g => {
            const el = $('qty-'+g.slug);
            if(el) el.addEventListener('input', updateSummary);
        });
    }

    const summaryBar = $('summary-bar');
    if (summaryBar) {
        summaryBar.innerHTML = state.activeGames.map(g => `<div class="summary-item"><span>${g.nome}</span><strong id="s-${g.slug}-qty">0 jogos</strong></div>`).join('') +
            `<div class="summary-item"><span>Total</span><strong id="s-total">R$ 0,00</strong></div>`;
    }

    const tabsContainer = $('dynamic-tabs');
    const contentsContainer = $('dynamic-tab-contents');
    if (tabsContainer && contentsContainer) {
        tabsContainer.innerHTML = state.activeGames.map((g, idx) => `
            <button class="tab ${idx === 0 ? 'active' : ''}" data-tab="tab-${g.slug}">${g.nome}</button>
        `).join('');
        
        contentsContainer.innerHTML = state.activeGames.map((g, idx) => {
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

        state.activeGames.forEach(g => {
            const btn = $('btn-copy-'+g.slug);
            if(btn) {
                btn.addEventListener('click', () => {
                    const st = state.currentGamesData[g.slug];
                    if(!st || !st.games) return;
                    const data = st.games.map(arr => arr.map(n => pad(n)).join(' ')).join('\n');
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
    
    const options = state.activeGames.map(g => `<option value="${g.slug}">${g.nome}</option>`).join('');
    if (finBetType) finBetType.innerHTML = options;
    if (finPrizeType) finPrizeType.innerHTML = options;
    
    if (finFilters) {
        finFilters.innerHTML = `
            <button class="fin-filter active" data-filter="all">Todos</button>
            <button class="fin-filter" data-filter="bet">Gastos</button>
            <button class="fin-filter" data-filter="prize">Prêmios</button>
            ${state.activeGames.map(g => `<button class="fin-filter" data-filter="${g.slug}">${g.nome}</button>`).join('')}
        `;
        $$('.fin-filter').forEach(btn => btn.addEventListener('click', (e) => {
            $$('.fin-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            setFinFilter(e.target.dataset.filter);
        }));
    }

    updateSummary();
}

export function updateSummary() {
    let totalCost = 0;
    const qtys = {};
    state.activeGames.forEach(g => {
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

export async function generateAll() {
    const qtys = updateSummary();
    const totalQty = Object.values(qtys).reduce((a,b)=>a+b, 0);
    if (totalQty === 0) { toast('Selecione a quantidade de jogos'); return; }

    const btn = $('btn-generate');
    if(!btn) return;
    btn.classList.add('loading');
    btn.textContent = 'Gerando...';

    const strategyRadio = document.querySelector('input[name="strategy"]:checked');
    const strategyName = strategyRadio ? strategyRadio.value : 'statistical';
    
    try {
        let hasSelections = false;
        for (const g of state.activeGames) {
            const qty = qtys[g.slug] || 0;
            const st = state.currentGamesData[g.slug];
            if(!st) continue;

            let history = [];
            if (strategyName !== 'statistical') {
                history = await historyManager.getHistory(g.slug);
            }

            const kept = st.games.filter((_, i) => st.selected.has(i));
            const needed = qty - kept.length;
            
            let newGames = [];
            if (needed > 0) {
                // Lê a quantidade personalizada de dezenas do input
                const sizeEl = $(`size-${g.slug}`);
                let customSize = sizeEl && sizeEl.value ? parseInt(sizeEl.value, 10) : g.parametros.pick_size;
                if (customSize < g.parametros.pick_size) customSize = g.parametros.pick_size;
                if (customSize > g.parametros.range_max) customSize = g.parametros.range_max;

                newGames = strategyEngine.run(strategyName, needed, { ...g.parametros, slug: g.slug, pick_size: customSize }, history, kept);
            }
            
            st.games = [...kept, ...newGames];
            st.page = 0;
            if(st.selected.size > 0) hasSelections = true;
            st.selected.clear();
        }

        renderGames();

        const resArea = $('results-area');
        if(resArea) {
            resArea.classList.remove('hidden');
        }

        if(typeof saveHistoryData === 'function') saveHistoryData();
        
        if (!hasSelections) toast('Jogos gerados e salvos no histórico!', 'success', 'top-right');
        else toast('Jogos complementados e salvos!', 'success', 'top-right');

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

export function renderGames() {
    state.activeGames.forEach(g => {
        const st = state.currentGamesData[g.slug];
        const container = $(g.slug + '-games');
        if(!container || !st) return;
        
        const itemsPerPage = 6;
        const totalItems = st.games.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (st.page === undefined) st.page = 0;
        if (st.page >= totalPages && totalPages > 0) {
            st.page = totalPages - 1;
        }
        if (st.page < 0) st.page = 0;

        const startIdx = st.page * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const paginatedGames = st.games.slice(startIdx, endIdx);

        let html = paginatedGames.map((game, relativeIdx) => {
            const idx = startIdx + relativeIdx;
            const sel = st.selected.has(idx);

            // Suporta jogo como array plano OU como objeto { dezenas, trevos, mes, time }
            const dezenas = Array.isArray(game) ? game : (game.dezenas || []);
            const stats = metricsCalculator.calculate(dezenas, g.parametros);

            // Tags de campos especiais (inserção manual)
            let extraTags = '';
            if (!Array.isArray(game)) {
                if (game.trevos && game.trevos.length > 0) {
                    extraTags += `<span style="background:rgba(232,180,77,.15);color:var(--gold);border:1px solid var(--gold-border);border-radius:4px;padding:1px 7px;font-size:.7rem;font-weight:700;">🍀 ${game.trevos.join(', ')}</span>`;
                }
                const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                if (game.mes) {
                    extraTags += `<span style="background:rgba(78,205,196,.12);color:var(--teal);border:1px solid var(--teal-border);border-radius:4px;padding:1px 7px;font-size:.7rem;font-weight:700;">📅 ${meses[game.mes] || game.mes}</span>`;
                }
                if (game.time) {
                    extraTags += `<span style="background:rgba(109,213,117,.10);color:var(--green);border:1px solid var(--green-border);border-radius:4px;padding:1px 7px;font-size:.7rem;font-weight:700;">🏆 ${game.time}</span>`;
                }
            }

            return `
            <div class="game-card ${sel ? 'selected' : ''}" data-slug="${g.slug}" data-idx="${idx}">
                <div class="game-top" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="game-label" style="margin-bottom: 0;">Jogo ${pad(idx + 1)}</span>
                        ${extraTags}
                    </div>
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
                <div class="game-numbers" style="margin-top: 12px; margin-bottom: 12px;">${dezenas.map(n => renderBall(n, g.slug)).join('')}</div>
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
                <button class="btn-sm prev-page-btn" data-slug="${g.slug}" ${st.page === 0 ? 'disabled' : ''}>Anterior</button>
                <span style="font-size: 0.85rem; color: var(--text-2);">Página <strong>${st.page + 1}</strong> de <strong>${totalPages}</strong></span>
                <button class="btn-sm next-page-btn" data-slug="${g.slug}" ${st.page === totalPages - 1 ? 'disabled' : ''}>Próxima</button>
            </div>
            `;
        }

        container.innerHTML = html;
    });

    $$('.prev-page-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const slug = e.currentTarget.dataset.slug;
            if (state.currentGamesData[slug].page > 0) {
                state.currentGamesData[slug].page--;
                renderGames();
            }
        });
    });

    $$('.next-page-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const slug = e.currentTarget.dataset.slug;
            const itemsPerPage = 6;
            const totalPages = Math.ceil(state.currentGamesData[slug].games.length / itemsPerPage);
            if (state.currentGamesData[slug].page < totalPages - 1) {
                state.currentGamesData[slug].page++;
                renderGames();
            }
        });
    });

    $$('.btn-select').forEach(b => {
        b.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const slug = btn.dataset.slug;
            const idx = parseInt(btn.dataset.idx);
            const st = state.currentGamesData[slug];
            if(!st) return;
            if(st.selected.has(idx)) st.selected.delete(idx);
            else st.selected.add(idx);
            renderGames();
        });
    });

    $$('.btn-copy-one').forEach(b => {
        b.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const slug = btn.dataset.slug;
            const idx = parseInt(btn.dataset.idx);
            const game = state.currentGamesData[slug].games[idx];
            navigator.clipboard.writeText(game.map(n=>pad(n)).join(' '));
            toast('Jogo copiado!');
        });
    });

    renderAnalysis();
}

export function renderAnalysis() {
    const ab = $('analysis-body');
    if (!ab) return;
    
    let h = '';
    h += `<div class="analysis-section" style="margin-bottom: 16px;"><p style="font-size:.8rem;color:var(--text-2);margin-bottom:8px">
        Modo de Geração: <strong style="color:var(--gold)">${MODES[state.generationMode]?.label || 'Dinâmico'}</strong></p></div>`;

    let hasData = false;
    state.activeGames.forEach(g => {
        const st = state.currentGamesData[g.slug];
        if (!st || st.games.length === 0) return;
        hasData = true;

        const maxDezenas = parseInt(g.dezenas_range) || 60;
        
        const freq = {};
        for (let i = 1; i <= maxDezenas; i++) freq[i] = 0;
        st.games.forEach(game => game.forEach(n => {
            if (freq[n] !== undefined) freq[n]++;
        }));

        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const bot5 = sorted.slice(-5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const avgEv = (st.games.reduce((s, game) => s + countEven(game), 0) / st.games.length).toFixed(1);
        const avgMaxSeq = (st.games.reduce((s, game) => s + maxConsec(game), 0) / st.games.length).toFixed(1);

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

    if (!hasData) h = '<p style="color:var(--text-3);font-size:.85rem">Gere jogos para ver a análise estatística.</p>';
    ab.innerHTML = h;
}
