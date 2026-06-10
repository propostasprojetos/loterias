const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// The goal is to comment out or delete the hardcoded LF/QN functions
// and inject our new generic engine.

// Let's replace the whole block from "// ===== LOTOFÁCIL — Core Validation" 
// to just before "// ===== HISTORY"
const startMarker = "// ===== LOTOFÁCIL — Core Validation (unchanged) =====";
const endMarker = "// ===== HISTORY (localStorage) =====";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const newEngine = `// ===== GENERIC GAME ENGINE =====

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
            if (modulos[g.slug] !== undefined) return modulos[g.slug];
            return planGameIds.includes(g.id);
        });

        currentGamesData = {};
        activeGames.forEach(g => {
            currentGamesData[g.slug] = { games: [], selected: new Set() };
        });

        renderDynamicGameUI();
    } catch(e) { console.error('Erro ao carregar jogos:', e); }
}

function renderDynamicGameUI() {
    const configGrid = $('config-grid');
    if (configGrid) {
        configGrid.innerHTML = activeGames.map(g => {
            const cost = g.parametros.cost || 3.00;
            return \`
                <div class="field">
                    <label title="Apostas para \${g.nome}">\${g.nome}</label>
                    <div class="input-row">
                        <span class="prefix">Qtd</span>
                        <input type="number" id="qty-\${g.slug}" value="0" min="0" data-cost="\${cost}">
                    </div>
                </div>
            \`;
        }).join('');
        
        activeGames.forEach(g => {
            const el = $('qty-'+g.slug);
            if(el) el.addEventListener('input', updateSummary);
        });
    }

    const summaryBar = $('summary-bar');
    if (summaryBar) {
        summaryBar.innerHTML = activeGames.map(g => \`<div class="summary-item"><span>\${g.nome}</span><strong id="s-\${g.slug}-qty">0 jogos</strong></div>\`).join('') +
            \`<div class="summary-item"><span>Total</span><strong id="s-total">R$ 0,00</strong></div>\`;
    }

    const tabsContainer = $('dynamic-tabs');
    const contentsContainer = $('dynamic-tab-contents');
    if (tabsContainer && contentsContainer) {
        tabsContainer.innerHTML = activeGames.map((g, idx) => \`
            <button class="tab \${idx === 0 ? 'active' : ''}" data-tab="tab-\${g.slug}">\${g.nome}</button>
        \`).join('');
        
        contentsContainer.innerHTML = activeGames.map((g, idx) => {
            const p = g.parametros || {};
            return \`
                <div id="tab-\${g.slug}" class="tab-content \${idx === 0 ? 'active' : ''}">
                    <div class="tab-toolbar">
                        <span class="tab-info">\${p.pick_size||0} dezenas · 1 a \${p.range_max||0}</span>
                        <button class="btn-sm" id="btn-copy-\${g.slug}">Copiar todos</button>
                    </div>
                    <div class="games-list" id="\${g.slug}-games"></div>
                </div>
            \`;
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
                    const data = state.games.map(arr => arr.map(n => pad(n)).join(' ')).join('\\n');
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
    
    const options = activeGames.map(g => \`<option value="\${g.slug}">\${g.nome}</option>\`).join('');
    if (finBetType) finBetType.innerHTML = options;
    if (finPrizeType) finPrizeType.innerHTML = options;
    
    if (finFilters) {
        finFilters.innerHTML = \`
            <button class="fin-filter active" data-filter="all">Todos</button>
            <button class="fin-filter" data-filter="bet">Gastos</button>
            <button class="fin-filter" data-filter="prize">Prêmios</button>
            \${activeGames.map(g => \`<button class="fin-filter" data-filter="\${g.slug}">\${g.nome}</button>\`).join('')}
        \`;
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

function generateGenericGames(count, params, keptGames = []) {
    if (count <= 0) return [];
    const poolSize = count * 5;
    const candidates = [];
    const max = params.range_max || 60;
    const pick = params.pick_size || 6;
    const all = Array.from({length: max}, (_, i) => i + 1);

    for (let i = 0; i < poolSize * 10 && candidates.length < poolSize; i++) {
        const g = shuffle(all).slice(0, pick).sort((a,b) => a-b);
        if (!candidates.some(c => c.every((v, idx) => v === g[idx]))) {
            candidates.push(g);
        }
    }

    if (candidates.length === 0) return [];

    const selected = [...keptGames];
    const result = [];
    const maxIntersect = Math.max(1, Math.floor(pick * 0.6));

    while (result.length < count) {
        let bestIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < candidates.length; i++) {
            if (!candidates[i]) continue;
            let penalty = 0;
            for (const sel of selected) {
                const common = intersect(candidates[i], sel).length;
                if (common > maxIntersect) penalty += 100;
                else penalty += common;
            }
            const score = -penalty; 
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        if (bestIdx !== -1) {
            const chosen = candidates[bestIdx];
            result.push(chosen);
            selected.push(chosen);
            candidates[bestIdx] = null;
        } else {
            break;
        }
    }
    return result;
}

function generateAll() {
    const qtys = updateSummary();
    const totalQty = Object.values(qtys).reduce((a,b)=>a+b, 0);
    if (totalQty === 0) { toast('Selecione a quantidade de jogos'); return; }

    const btn = $('btn-generate');
    if(!btn) return;
    btn.classList.add('loading');
    btn.textContent = 'Gerando...';

    setTimeout(() => {
        let hasSelections = false;
        activeGames.forEach(g => {
            const qty = qtys[g.slug] || 0;
            const state = currentGamesData[g.slug];
            if(!state) return;
            if (state.selected.size === 0) {
                state.games = generateGenericGames(qty, g.parametros, []);
            } else {
                const kept = state.games.filter((_, i) => state.selected.has(i));
                const needed = qty - kept.length;
                const newGames = generateGenericGames(needed, g.parametros, kept);
                state.games = [...kept, ...newGames];
            }
            if(state.selected.size > 0) hasSelections = true;
            state.selected.clear();
        });

        renderGames();
        
        const resArea = $('results-area');
        if(resArea) {
            resArea.classList.remove('hidden');
            resArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        saveToHistory();
        if (!hasSelections) toast('Jogos gerados e salvos no histórico!');

        btn.classList.remove('loading');
        btn.textContent = 'Gerar Jogos';

        let regBtn = $('btn-register-bet-gen');
        if (!regBtn) {
            regBtn = document.createElement('button');
            regBtn.id = 'btn-register-bet-gen';
            regBtn.className = 'btn-secondary';
            regBtn.textContent = '💰 Registrar aposta no Financeiro';
            regBtn.addEventListener('click', registerBetFromGenerator);
            btn.parentNode.insertBefore(regBtn, btn.nextSibling);
        }
    }, 300);
}

function renderGames() {
    activeGames.forEach(g => {
        const state = currentGamesData[g.slug];
        const container = $(g.slug + '-games');
        if(!container || !state) return;
        
        container.innerHTML = state.games.map((game, idx) => {
            const sel = state.selected.has(idx);
            return \`
            <div class="game-card \${sel ? 'selected' : ''}" data-slug="\${g.slug}" data-idx="\${idx}">
                <div class="game-top">
                    <span class="game-label">Jogo \${pad(idx + 1)}</span>
                    <div class="game-actions">
                        <button class="btn-icon btn-copy-one" title="Copiar jogo" data-slug="\${g.slug}" data-idx="\${idx}">\${ICON.copy}</button>
                        <button class="btn-icon btn-select \${sel ? 'checked' : ''}" title="Manter jogo" data-slug="\${g.slug}" data-idx="\${idx}">\${sel ? ICON.check : ICON.pin}</button>
                    </div>
                </div>
                <div class="game-numbers">\${game.map(n => renderBall(n, g.slug)).join('')}</div>
            </div>\`;
        }).join('');
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
}

function renderAnalysis() {
    const ab = $('analysis-body');
    if(ab) ab.innerHTML = '<p>Análise estatística dinâmica ativada.</p>';
}

`;

    content = content.slice(0, startIndex) + newEngine + content.slice(endIndex);
}

// Next, let's fix checkAuthState to call loadAvailableGames
// It is around "const currentView = document.querySelector"
// We'll replace it.
content = content.replace("const currentView = document.querySelector('[id^=\"view-\"]:not(.hidden)');", 
    "await loadAvailableGames();\n                const currentView = document.querySelector('[id^=\"view-\"]:not(.hidden)');");

// Next, fix registerBetFromGenerator
// There is an existing registerBetFromGenerator at line ~1945
const rbStart = content.indexOf("function registerBetFromGenerator()");
if(rbStart !== -1) {
    const rbEnd = content.indexOf("}", rbStart);
    if(rbEnd !== -1) {
        const newRB = `function registerBetFromGenerator() {
    const qtys = updateSummary();
    const today = new Date().toISOString().slice(0, 10);
    
    activeGames.forEach(async (g) => {
        const qty = qtys[g.slug];
        if (qty > 0) {
            const cost = parseFloat($('qty-'+g.slug)?.dataset.cost) || 0;
            const total = qty * cost;
            if (currentSession && supabaseClient) {
                await supabaseClient.from('bets').insert({
                    user_id: currentSession.user.id,
                    type: g.slug,
                    qty: qty,
                    total_amount: total,
                    bet_date: today,
                    notes: 'Gerado no LotoSmart'
                });
            }
        }
    });
    toast('Apostas registradas no financeiro!');
    switchView('financeiro');
    if(typeof refreshFinancialData === 'function') refreshFinancialData();
`;
        content = content.slice(0, rbStart) + newRB + content.slice(rbEnd);
    }
}

// Next, fix loadFromHistory and saveToHistory to use currentGamesData instead of currentLF/currentQN
content = content.replace(/lf: currentLF,/g, "games: currentGamesData,");
content = content.replace(/qn: currentQN/g, "");
content = content.replace(/currentLF = entry.lf \|\| \[\];/g, "currentGamesData = entry.games || {};");
content = content.replace(/currentQN = entry.qn \|\| \[\];/g, "");
content = content.replace(/selectedLF\.clear\(\);/g, "");
content = content.replace(/selectedQN\.clear\(\);/g, "");
content = content.replace(/if \(!currentLF\.length && !currentQN\.length\) return;/g, "");

// Remove old global state currentLF, currentQN etc.
content = content.replace(/let currentLF = \[\];/g, "");
content = content.replace(/let currentQN = \[\];/g, "");
content = content.replace(/let selectedLF = new Set\(\);/g, "");
content = content.replace(/let selectedQN = new Set\(\);/g, "");
content = content.replace(/let currentBaseSetLF = null;/g, "");

fs.writeFileSync('app.js', content, 'utf8');
console.log('app.js refactored successfully.');
