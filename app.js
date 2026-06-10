// ===== LotoSmart v2 — Advanced Optimization Engine =====

// ===== UTILS =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

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
function fmt(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }
function pad(n) { return String(n).padStart(2, '0'); }

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
            return `
                <div class="field">
                    <label title="Apostas para ${g.nome}">${g.nome}</label>
                    <div class="input-row">
                        <span class="prefix">Qtd</span>
                        <input type="number" id="qty-${g.slug}" value="0" min="0" data-cost="${cost}">
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
            return `
            <div class="game-card ${sel ? 'selected' : ''}" data-slug="${g.slug}" data-idx="${idx}">
                <div class="game-top">
                    <span class="game-label">Jogo ${pad(idx + 1)}</span>
                    <div class="game-actions">
                        <button class="btn-icon btn-copy-one" title="Copiar jogo" data-slug="${g.slug}" data-idx="${idx}">${ICON.copy}</button>
                        <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Manter jogo" data-slug="${g.slug}" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
                    </div>
                </div>
                <div class="game-numbers">${game.map(n => renderBall(n, g.slug)).join('')}</div>
            </div>`;
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
    if (!confirm('Limpar todo o histórico?')) return;
    saveHistoryData([]);
    renderHistory();
}

function loadFromHistory(entry) {
    activeGames.forEach(g => {
        if(entry.gamesData[g.slug]) {
            currentGamesData[g.slug] = {
                games: entry.gamesData[g.slug],
                selected: new Set()
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
            deleteHistoryEntry(id);
        });
    });
}

// ===== TOAST =====
function toast(msg) {
    $('toast-msg').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2500);
}

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
        sbReady = true;
        console.log('Supabase initialized successfully');
        return true;
    } catch (e) {
        console.warn('Supabase not available:', e.message);
        sbReady = false;
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
        currentProfile = null;

        if (session) {
            const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
            if (!error && profile) {
                currentProfile = profile;
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
            currentProfile = null;
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
            navGerador.style.display = 'none';
            navHistorico.style.display = 'none';
            navFinanceiro.style.display = 'none';
            navAdmin.style.display = 'none';
            userMenu.style.display = 'none';
            activeGames = [];
            currentGamesData = {};
            const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
            if (!currentView || (currentView.id !== 'view-login' && currentView.id !== 'view-contato')) {
                switchView('login');
            }
        } else {
            userMenu.style.display = 'flex';
            headerUserName.textContent = (profile && profile.name) || user.email;

            if (profile && profile.must_change_password) {
                navGerador.style.display = 'none';
                navHistorico.style.display = 'none';
                navFinanceiro.style.display = 'none';
                navAdmin.style.display = 'none';
                switchView('change-password');
            } else {
                navGerador.style.display = 'inline-block';
                navHistorico.style.display = 'inline-block';
                navFinanceiro.style.display = 'inline-block';
                
                if (window.isSuperAdmin) {
                    navAdmin.style.display = 'inline-block';
                } else {
                    navAdmin.style.display = 'none';
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
    if (sbReady && currentSession) {
        try {
            const dataWithOwner = { ...betData, owner_id: currentSession.user.id };
            const { error } = await supabaseClient.from('bets').insert(dataWithOwner);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase create bet failed, using localStorage:', e);
            const bets = loadLocalBets();
            bets.unshift({ ...betData, id: Date.now().toString(), created: new Date().toISOString() });
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets();
        bets.unshift({ ...betData, id: Date.now().toString(), created: new Date().toISOString() });
        saveLocalBets(bets);
    }
    await refreshFinancialData();
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
    const emptyEl = $('fin-table-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

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
                <button class="btn-icon btn-table-action btn-del-transaction" title="Excluir" data-id="${t.id}" data-source="${t.source}">${ICON.copy.replace('copy', 'x')}</button>
            </td>
        </tr>`;
    }).join('');

    // Bind delete buttons
    tbody.querySelectorAll('.btn-del-transaction').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Excluir esta transação?')) return;
            const id = btn.dataset.id;
            const source = btn.dataset.source;
            if (source === 'bets') await deleteBet(id);
            else await deletePrize(id);
        });
    });
}

// ===== DELETE ICON =====
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>`;

// ===== FINANCIAL CHART =====
function renderFinancialChart() {
    const ctx = $('fin-chart');
    if (!ctx) return;

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
            addBet({
                bet_date: today,
                lottery_type: g.slug,
                game_count: qty,
                total_cost: total,
                contest_number: null,
                notes: `Gerado no LotoSmart`,
                games: JSON.stringify(currentGamesData[g.slug]?.games || [])
            });
        }
    });

    toast('💰 Apostas registradas no financeiro!');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    $('btn-generate')?.addEventListener('click', generateAll);
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

    // Initialize Supabase and check session
    initSupabase().then(async () => {
        await checkAuthState();
        if (currentSession && (!currentProfile || !currentProfile.must_change_password)) {
            refreshFinancialData();
        }
    });
});



