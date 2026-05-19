// ===== LotoSmart v2 =====

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

// ===== LOTOFÁCIL =====
function lfRow(n) { return Math.ceil(n / 5); }
function lfCol(n) { return ((n - 1) % 5) + 1; }

function validateLF(g) {
    const ev = countEven(g);
    if (ev < 7 || ev > 8) return false;
    const lo = g.filter(n => n <= 13).length;
    if (lo < 6 || lo > 9) return false;
    if (maxConsec(g) > 2) return false;
    const rows = [0, 0, 0, 0, 0];
    g.forEach(n => rows[lfRow(n) - 1]++);
    if (rows.some(r => r < 2 || r > 4)) return false;
    const cols = [0, 0, 0, 0, 0];
    g.forEach(n => cols[lfCol(n) - 1]++);
    if (cols.some(c => c >= 5)) return false;
    const triples = [[1, 2, 3], [1, 2, 4], [23, 24, 25]];
    for (const t of triples) if (t.every(n => g.includes(n))) return false;
    return true;
}

function genOneLF() {
    const all = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = 0; i < 5000; i++) {
        const g = shuffle(all).slice(0, 15).sort((a, b) => a - b);
        if (validateLF(g)) return g;
    }
    const ev = shuffle([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    const od = shuffle([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
    const ne = randomInt(7, 8);
    return [...ev.slice(0, ne), ...od.slice(0, 15 - ne)].sort((a, b) => a - b);
}

function genLFGames(count) {
    const games = [];
    let att = 0;
    while (games.length < count && att < count * 200) {
        const g = genOneLF(); att++;
        if (games.some(e => intersect(g, e).length > 10)) continue;
        games.push(g);
    }
    return games;
}

// ===== QUINA =====
function validateQN(g) {
    const ev = countEven(g);
    if (ev < 2 || ev > 3) return false;
    const ranges = [0, 0, 0, 0];
    g.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
    if (ranges.filter(r => r > 0).length < 3) return false;
    if (ranges.some(r => r > 2)) return false;
    if (maxConsec(g) > 2) return false;
    const s = [...g].sort((a, b) => a - b);
    if (Math.min(...s.slice(1).map((n, i) => n - s[i])) < 3) return false;
    return true;
}

function genOneQN() {
    const all = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = 0; i < 5000; i++) {
        const g = shuffle(all).slice(0, 5).sort((a, b) => a - b);
        if (validateQN(g)) return g;
    }
    const R = [0, 1, 2, 3].map(i => shuffle(Array.from({ length: 20 }, (_, j) => j + 1 + i * 20)));
    const o = shuffle([0, 1, 2, 3]);
    return [R[o[0]][0], R[o[1]][0], R[o[2]][0], R[o[3]][0], R[o[randomInt(0, 3)]][1]].sort((a, b) => a - b);
}

function genQNGames(count) {
    const games = [];
    let att = 0;
    while (games.length < count && att < count * 200) {
        const g = genOneQN(); att++;
        if (games.some(e => intersect(g, e).length > 2)) continue;
        games.push(g);
    }
    return games;
}

// ===== SVG ICONS =====
const ICON = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M5 12h14M7 7l2-4h6l2 4v5H7V7z"/></svg>`,
};

// ===== STATE =====
let currentLF = [];
let currentQN = [];
let selectedLF = new Set();
let selectedQN = new Set();

// ===== RENDER =====
function renderBall(n, type) {
    const cls = (n % 2 === 0 ? 'even' : 'odd') + (type === 'qn' ? ' qn' : '');
    return `<span class="ball ${cls}">${pad(n)}</span>`;
}

function renderLFCard(game, idx) {
    const ev = countEven(game), od = 15 - ev;
    const lo = game.filter(n => n <= 13).length, hi = 15 - lo;
    const rows = [0, 0, 0, 0, 0];
    game.forEach(n => rows[lfRow(n) - 1]++);
    const sel = selectedLF.has(idx);
    return `<div class="game-card ${sel ? 'selected' : ''}" data-type="lf" data-idx="${idx}">
        <div class="game-top">
            <span class="game-label">Jogo ${pad(idx + 1)}</span>
            <div class="game-actions">
                <div class="game-meta">
                    <span class="meta-tag meta-par">${ev}P</span>
                    <span class="meta-tag meta-impar">${od}I</span>
                    <span class="meta-tag meta-low">${lo}↓</span>
                    <span class="meta-tag meta-high">${hi}↑</span>
                </div>
                <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="lf" data-idx="${idx}">${ICON.copy}</button>
                <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Manter jogo" data-type="lf" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
            </div>
        </div>
        <div class="game-numbers">${game.map(n => renderBall(n, 'lf')).join('')}</div>
        <div class="game-bottom">
            <span class="game-stat">Linhas: ${rows.join('-')}</span>
            <span class="game-stat">Seq: ${maxConsec(game)}</span>
        </div>
    </div>`;
}

function renderQNCard(game, idx) {
    const ev = countEven(game), od = 5 - ev;
    const rl = ['1–20', '21–40', '41–60', '61–80'];
    const ranges = [0, 0, 0, 0];
    game.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
    const rStr = ranges.map((r, i) => r > 0 ? rl[i] + ':' + r : null).filter(Boolean).join(' ');
    const s = [...game].sort((a, b) => a - b);
    const gaps = s.slice(1).map((n, i) => n - s[i]);
    const avgG = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
    const sel = selectedQN.has(idx);
    return `<div class="game-card ${sel ? 'selected' : ''}" data-type="qn" data-idx="${idx}">
        <div class="game-top">
            <span class="game-label">Jogo ${pad(idx + 1)}</span>
            <div class="game-actions">
                <div class="game-meta">
                    <span class="meta-tag meta-par">${ev}P</span>
                    <span class="meta-tag meta-impar">${od}I</span>
                </div>
                <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="qn" data-idx="${idx}">${ICON.copy}</button>
                <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Manter jogo" data-type="qn" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
            </div>
        </div>
        <div class="game-numbers">${game.map(n => renderBall(n, 'qn')).join('')}</div>
        <div class="game-bottom">
            <span class="game-stat">Faixas: ${rStr}</span>
            <span class="game-stat">Gap: ${avgG}</span>
        </div>
    </div>`;
}

function renderGames() {
    $('lf-games').innerHTML = currentLF.map((g, i) => renderLFCard(g, i)).join('');
    $('qn-games').innerHTML = currentQN.map((g, i) => renderQNCard(g, i)).join('');
    $('lf-info').textContent = `${currentLF.length} jogos · 15 dezenas · 01 a 25`;
    $('qn-info').textContent = `${currentQN.length} jogos · 5 dezenas · 01 a 80`;
    bindCardButtons();
}

function renderAnalysis() {
    let h = '';
    if (currentLF.length) {
        const freq = {};
        for (let i = 1; i <= 25; i++) freq[i] = 0;
        currentLF.forEach(g => g.forEach(n => freq[n]++));
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const bot5 = sorted.slice(-5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const avgEv = (currentLF.reduce((s, g) => s + countEven(g), 0) / currentLF.length).toFixed(1);
        h += `<div class="analysis-section"><h4>Lotofácil</h4><ul>
            <li>Mais frequentes: ${top5}</li><li>Menos frequentes: ${bot5}</li>
            <li>Média pares/jogo: ${avgEv}</li></ul></div>`;
    }
    if (currentQN.length) {
        const freq = {};
        for (let i = 1; i <= 80; i++) freq[i] = 0;
        currentQN.forEach(g => g.forEach(n => freq[n]++));
        const cov = Object.values(freq).filter(f => f > 0).length;
        h += `<div class="analysis-section"><h4>Quina</h4><ul>
            <li>Cobertura: ${cov}/80 dezenas (${((cov / 80) * 100).toFixed(0)}%)</li></ul></div>`;
    }
    h += `<div class="analysis-section"><p style="font-size:.78rem;color:var(--text-3);margin-top:8px">⚠️ Otimização estatística relativa — não garante premiação.</p></div>`;
    $('analysis-body').innerHTML = h;
}

// ===== BUDGET =====
function updateSummary() {
    const budget = parseFloat($('budget').value) || 0;
    const lfP = parseFloat($('lf-price').value) || 3;
    const qnP = parseFloat($('qn-price').value) || 2.5;
    const pct = parseInt($('split').value) || 60;

    const lfQ = Math.floor((budget * pct / 100) / lfP);
    const qnQ = Math.floor((budget * (100 - pct) / 100) / qnP);
    const total = lfQ * lfP + qnQ * qnP;

    $('s-lf-qty').textContent = lfQ + ' jogos';
    $('s-qn-qty').textContent = qnQ + ' jogos';
    $('s-total').textContent = fmt(total);
    $('s-change').textContent = fmt(budget - total);
    $('lf-pct-label').textContent = pct + '%';
    $('qn-pct-label').textContent = (100 - pct) + '%';

    const slider = $('split');
    slider.style.background = `linear-gradient(to right,var(--purple) ${pct}%,var(--surface-2) ${pct}%)`;

    return { lfQ, qnQ };
}

// ===== COPY =====
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => toast('Copiado!')).catch(() => toast('Erro ao copiar'));
}
function copyOneGame(type, idx) {
    const game = type === 'lf' ? currentLF[idx] : currentQN[idx];
    const label = type === 'lf' ? 'Lotofácil' : 'Quina';
    copyText(`${label} Jogo ${pad(idx + 1)}: ${game.map(pad).join(' - ')}`);
}
function copyAllGames(type) {
    const games = type === 'lf' ? currentLF : currentQN;
    const label = type === 'lf' ? 'Lotofácil' : 'Quina';
    const txt = games.map((g, i) => `Jogo ${pad(i + 1)}: ${g.map(pad).join(' - ')}`).join('\n');
    copyText(`=== ${label} ===\n${txt}\n\nGerado: ${new Date().toLocaleString('pt-BR')}`);
}

// ===== SELECT / DESELECT =====
function toggleSelect(type, idx) {
    const set = type === 'lf' ? selectedLF : selectedQN;
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    renderGames();
}

// ===== REGENERATE UNSELECTED =====
function regenerateUnselected() {
    const { lfQ, qnQ } = updateSummary();

    // Keep selected, regenerate the rest
    const keptLF = [];
    selectedLF.forEach(i => { if (currentLF[i]) keptLF.push(currentLF[i]); });
    const needLF = Math.max(0, lfQ - keptLF.length);
    const newLF = genLFGames(needLF);
    // Diversity check against kept games
    const filteredLF = [];
    for (const g of newLF) {
        if (!keptLF.some(k => intersect(g, k).length > 10) && !filteredLF.some(f => intersect(g, f).length > 10)) {
            filteredLF.push(g);
        }
    }
    currentLF = [...keptLF, ...filteredLF];

    const keptQN = [];
    selectedQN.forEach(i => { if (currentQN[i]) keptQN.push(currentQN[i]); });
    const needQN = Math.max(0, qnQ - keptQN.length);
    const newQN = genQNGames(needQN);
    const filteredQN = [];
    for (const g of newQN) {
        if (!keptQN.some(k => intersect(g, k).length > 2) && !filteredQN.some(f => intersect(g, f).length > 2)) {
            filteredQN.push(g);
        }
    }
    currentQN = [...keptQN, ...filteredQN];

    // Update selection indices (kept games are now at the start)
    selectedLF = new Set(keptLF.map((_, i) => i));
    selectedQN = new Set(keptQN.map((_, i) => i));

    renderGames();
    renderAnalysis();
    toast('Jogos não selecionados regenerados!');
}

// ===== GENERATE =====
function generateAll() {
    const { lfQ, qnQ } = updateSummary();
    if (lfQ === 0 && qnQ === 0) { toast('Orçamento insuficiente'); return; }

    const btn = $('btn-generate');
    btn.classList.add('loading');
    btn.textContent = 'Gerando...';

    setTimeout(() => {
        if (selectedLF.size === 0 && selectedQN.size === 0) {
            currentLF = genLFGames(lfQ);
            currentQN = genQNGames(qnQ);
            selectedLF.clear();
            selectedQN.clear();
        } else {
            regenerateUnselected();
        }

        renderGames();
        renderAnalysis();
        $('results-area').classList.remove('hidden');
        $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });

        btn.classList.remove('loading');
        btn.textContent = selectedLF.size || selectedQN.size ? 'Regenerar não selecionados' : 'Gerar Jogos';
    }, 300);
}

// ===== HISTORY (localStorage) =====
const HISTORY_KEY = 'lotosmart_history';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}
function saveHistoryData(data) { localStorage.setItem(HISTORY_KEY, JSON.stringify(data)); }

function saveToHistory() {
    if (!currentLF.length && !currentQN.length) return;
    const history = loadHistory();
    history.unshift({
        id: Date.now(),
        date: new Date().toLocaleString('pt-BR'),
        lf: currentLF,
        qn: currentQN
    });
    if (history.length > 50) history.length = 50;
    saveHistoryData(history);
    toast('Salvo no histórico!');
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
    currentLF = entry.lf || [];
    currentQN = entry.qn || [];
    selectedLF.clear();
    selectedQN.clear();
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
        const lfTxt = (h.lf || []).map((g, i) => `<div style="font-size:.78rem;color:var(--text-2);padding:2px 0;font-family:var(--mono)">J${pad(i + 1)}: ${g.map(pad).join(' ')}</div>`).join('');
        const qnTxt = (h.qn || []).map((g, i) => `<div style="font-size:.78rem;color:var(--text-2);padding:2px 0;font-family:var(--mono)">J${pad(i + 1)}: ${g.map(pad).join(' ')}</div>`).join('');
        return `<div class="history-entry" data-id="${h.id}">
            <div class="history-entry-header">
                <span class="history-date">${h.date}</span>
                <span class="history-summary">${(h.lf || []).length} LF · ${(h.qn || []).length} QN</span>
            </div>
            <div class="history-body">
                ${lfTxt ? `<p style="font-size:.75rem;font-weight:600;color:var(--purple);margin:10px 0 4px">LOTOFÁCIL</p>${lfTxt}` : ''}
                ${qnTxt ? `<p style="font-size:.75rem;font-weight:600;color:var(--cyan);margin:10px 0 4px">QUINA</p>${qnTxt}` : ''}
                <div class="history-actions">
                    <button class="btn-sm btn-load-hist">Carregar</button>
                    <button class="btn-sm btn-copy-hist">Copiar</button>
                    <button class="btn-sm btn-danger btn-del-hist">Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Bind history events
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
    $$('.btn-copy-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            const entry = loadHistory().find(h => h.id === id);
            if (!entry) return;
            let txt = `=== LotoSmart — ${entry.date} ===\n`;
            if (entry.lf?.length) { txt += '\nLOTOFÁCIL:\n'; entry.lf.forEach((g, i) => txt += `J${pad(i + 1)}: ${g.map(pad).join(' - ')}\n`); }
            if (entry.qn?.length) { txt += '\nQUINA:\n'; entry.qn.forEach((g, i) => txt += `J${pad(i + 1)}: ${g.map(pad).join(' - ')}\n`); }
            copyText(txt);
        });
    });
    $$('.btn-del-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            deleteHistoryEntry(id);
        });
    });
}

// ===== CARD BUTTONS =====
function bindCardButtons() {
    $$('.btn-copy-one').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            copyOneGame(btn.dataset.type, parseInt(btn.dataset.idx));
        });
    });
    $$('.btn-select').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggleSelect(btn.dataset.type, parseInt(btn.dataset.idx));
            // Update button text
            const hasSelection = selectedLF.size || selectedQN.size;
            $('btn-generate').textContent = hasSelection ? 'Regenerar não selecionados' : 'Gerar Jogos';
        });
    });
}

// ===== TOAST =====
function toast(msg) {
    $('toast-msg').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2500);
}

// ===== VIEW SWITCHING =====
function switchView(view) {
    $$('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    $('view-' + view).classList.remove('hidden');
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'historico') renderHistory();
}

// ===== TABS =====
function switchTab(tabId) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    $$('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === tabId));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    ['budget', 'lf-price', 'qn-price', 'split'].forEach(id => $(id).addEventListener('input', updateSummary));
    $('btn-generate').addEventListener('click', generateAll);
    $('btn-save-history').addEventListener('click', saveToHistory);
    $('btn-clear-history').addEventListener('click', clearHistory);
    $('btn-copy-all-lf').addEventListener('click', () => copyAllGames('lf'));
    $('btn-copy-all-qn').addEventListener('click', () => copyAllGames('qn'));
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    updateSummary();
});
