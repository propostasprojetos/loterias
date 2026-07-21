import { state } from './store.js';
import { renderGames } from './gerador.js';
import { pad } from './utils.js';

// ==========================================
// Regras de cada loteria para entrada manual
// ==========================================
const GAME_RULES = {
    megasena:       { minPick: 6,  maxPick: 20, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: false },
    lotofacil:      { minPick: 15, maxPick: 20, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: false },
    quina:          { minPick: 5,  maxPick: 15, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: false },
    maismilionaria: { minPick: 6,  maxPick: 12, hasTrevos: true,  hasMonth: false, hasTeam: false, fixed: false,
                      minTrevos: 2, maxTrevos: 6 },
    duplasena:      { minPick: 6,  maxPick: 15, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: false },
    diadesorte:     { minPick: 7,  maxPick: 15, hasTrevos: false, hasMonth: true,  hasTeam: false, fixed: false },
    supersete:      { minPick: 7,  maxPick: 7,  hasTrevos: false, hasMonth: false, hasTeam: false, fixed: true,
                      isSuperSete: true },
    timemania:      { minPick: 10, maxPick: 10, hasTrevos: false, hasMonth: false, hasTeam: true,  fixed: true },
    lotomania:      { minPick: 50, maxPick: 50, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: true },
    loteca:         { minPick: 14, maxPick: 14, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: true },
};

// Nomes dos meses para Dia de Sorte
const MONTHS = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Times da Timemania 2026-2028 (Portaria MESP nº 32)
const TIMEMANIA_TEAMS = [
    // Série A
    'Athletico-PR','Atlético-MG','Bahia','Botafogo-RJ','Chapecoense','Corinthians','Coritiba','Cruzeiro',
    'Flamengo','Fluminense','Grêmio','Internacional','Mirassol','Palmeiras','Red Bull Bragantino',
    'Remo','Santos','São Paulo','Vasco da Gama','Vitória',
    // Série B
    'América-MG','Athletic-MG','Atlético-GO','Avaí','Botafogo-SP','Ceará','CRB','Criciúma','Cuiabá',
    'Fortaleza','Goiás','Juventude','Londrina','Náutico','Novorizontino','Operário-PR','Ponte Preta',
    'São Bernardo','Sport','Vila Nova',
    // Série C
    'Amazonas','Anápolis','Barra-SC','Botafogo-PB','Brusque','Caxias','Confiança','Ferroviária',
    'Figueirense','Floresta','Guarani','Inter de Limeira','Itabaiana','Ituano','Maranhão','Maringá',
    'Paysandu','Santa Cruz','Volta Redonda','Ypiranga-RS',
    // Ranking CBF
    'ABC','Águia de Marabá','Altos','América-RN','Aparecidense','ASA','Brasil de Pelotas','Brasiliense',
    'Cascavel','CSA','Ferroviário-CE','Manaus','Nova Iguaçu','Porto Velho','Retrô','Sampaio Corrêa',
    'São José-RS','Sousa','Tombense','Tocantinópolis'
].sort((a, b) => a.localeCompare(b, 'pt'));

// DOM Elements
const btnManualEntry  = document.getElementById('btn-manual-entry');
const modalManual     = document.getElementById('manual-modal');
const btnCloseManual  = document.getElementById('btn-close-manual-modal');
const btnCancelManual = document.getElementById('btn-cancel-manual');
const btnAddManual    = document.getElementById('btn-add-manual');

const gameSelect       = document.getElementById('manual-game-select');
const qtySelect        = document.getElementById('manual-qty-select');
const numberInput      = document.getElementById('manual-number-input');
const btnManualUpload  = document.getElementById('btn-manual-upload');
const manualFileInput  = document.getElementById('manual-file-input');
const feedbackLabel    = document.getElementById('manual-feedback');
const currentCountLabel = document.getElementById('manual-current-count');
const targetCountLabel  = document.getElementById('manual-target-count');
const draftContainer   = document.getElementById('manual-draft-container');
const btnClearDraft    = document.getElementById('btn-clear-draft');
const validationList   = document.getElementById('manual-validation-list');
const statsLabel       = document.getElementById('manual-stats');

// Painéis de campos especiais
const panelMonth  = document.getElementById('manual-month-panel');
const selectMonth = document.getElementById('manual-month-select');
const panelTeam   = document.getElementById('manual-team-panel');
const selectTeam  = document.getElementById('manual-team-select');
const panelTrevos = document.getElementById('manual-trevos-panel');

// ==========================================
// Estado interno
// ==========================================
let validGamesQueue  = [];
let currentDraftGame = [];
let feedbackTimeout;

// ==========================================
// Event Listeners
// ==========================================
if (btnManualEntry)  btnManualEntry.addEventListener('click', openModal);
if (btnCloseManual)  btnCloseManual.addEventListener('click', closeModal);
if (btnCancelManual) btnCancelManual.addEventListener('click', closeModal);
if (btnAddManual)    btnAddManual.addEventListener('click', addValidGames);

if (gameSelect) gameSelect.addEventListener('change', () => {
    currentDraftGame = [];
    validGamesQueue  = [];
    applyGameRules();
    renderDraftUI();
    renderCompletedUI();
});

if (qtySelect) qtySelect.addEventListener('change', () => {
    currentDraftGame = [];
    renderDraftUI();
});

if (btnClearDraft) btnClearDraft.addEventListener('click', () => {
    currentDraftGame = [];
    renderDraftUI();
});
if (btnManualUpload) btnManualUpload.addEventListener('click', () => manualFileInput?.click());
if (manualFileInput) manualFileInput.addEventListener('change', handleFileUpload);

if (numberInput) {
    numberInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
            e.preventDefault();
            const val = numberInput.value;
            if (val.trim()) {
                processInputText(val);
                numberInput.value = '';
            }
        }
    });

    numberInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        if (pasteData) processInputText(pasteData);
    });
}

// ==========================================
// Funções de Abertura / Fechamento
// ==========================================
function openModal() {
    if (!state.activeGames || state.activeGames.length === 0) {
        alert('Nenhum jogo ativo encontrado. Peça para o administrador liberar os jogos para você.');
        return;
    }

    if (gameSelect) {
        gameSelect.innerHTML = state.activeGames.map(g =>
            `<option value="${g.slug}">${g.nome}</option>`
        ).join('');
    }

    // Popular select de times da Timemania
    if (selectTeam) {
        selectTeam.innerHTML = TIMEMANIA_TEAMS.map(t =>
            `<option value="${t}">${t}</option>`
        ).join('');
    }

    validGamesQueue  = [];
    currentDraftGame = [];
    applyGameRules();
    renderDraftUI();
    renderCompletedUI();

    modalManual.classList.remove('hidden');
    numberInput?.focus();
}

function closeModal() {
    modalManual.classList.add('hidden');
}

// ==========================================
// Regras dinâmicas por loteria
// ==========================================
function getSelectedGame() {
    const slug = gameSelect?.value;
    return state.activeGames.find(g => g.slug === slug);
}

function getRules(slug) {
    return GAME_RULES[slug] || { minPick: 6, maxPick: 6, hasTrevos: false, hasMonth: false, hasTeam: false, fixed: true };
}

function getSelectedQty() {
    const game = getSelectedGame();
    if (!game) return 6;
    const rules = getRules(game.slug);
    if (qtySelect && !rules.fixed) {
        return parseInt(qtySelect.value) || rules.minPick;
    }
    return rules.minPick;
}

function applyGameRules() {
    const game = getSelectedGame();
    if (!game) return;
    const rules = getRules(game.slug);

    // Mostra / oculta o select de quantidade de dezenas
    const qtyWrapper = document.getElementById('manual-qty-wrapper');
    if (qtyWrapper) {
        if (rules.fixed || rules.isSuperSete) {
            qtyWrapper.classList.add('hidden');
        } else {
            qtyWrapper.classList.remove('hidden');
            // Popula o select
            if (qtySelect) {
                let opts = '';
                for (let i = rules.minPick; i <= rules.maxPick; i++) {
                    opts += `<option value="${i}">${i} dezenas</option>`;
                }
                qtySelect.innerHTML = opts;
                qtySelect.value = rules.minPick;
            }
        }
    }

    // Instrução no input
    if (numberInput) {
        if (rules.isSuperSete) {
            numberInput.placeholder = 'Dígito 0-9 por coluna (7 no total)';
        } else {
            numberInput.placeholder = 'Ex: 01 (Aperte Enter)';
        }
    }

    // Mês de Sorte
    if (panelMonth) {
        panelMonth.classList.toggle('hidden', !rules.hasMonth);
    }

    // Time do Coração
    if (panelTeam) {
        panelTeam.classList.toggle('hidden', !rules.hasTeam);
        // Quando Timemania está ativo, desabilitar digitação de dezenas (10 fixas)
        if (numberInput) {
            numberInput.disabled = false; // sempre ativo
        }
    }

    // Trevos (+Milionária)
    if (panelTrevos) {
        panelTrevos.classList.toggle('hidden', !rules.hasTrevos);
        if (rules.hasTrevos) {
            // Reset checkboxes
            panelTrevos.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
        }
    }
}

// ==========================================
// Processamento de Dezenas
// ==========================================
function showFeedback(msg, isError = true) {
    feedbackLabel.textContent = msg;
    feedbackLabel.style.color = isError ? 'var(--red)' : 'var(--green)';
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => { feedbackLabel.textContent = ''; }, 3000);
}

function processInputText(text) {
    const game = getSelectedGame();
    if (!game) return;

    const rules      = getRules(game.slug);
    const requiredSize = getSelectedQty();
    const maxNum     = game.parametros?.range_max ?? 60;
    const minNum     = game.parametros?.range_min ?? 1;

    const matches = text.match(/\d+/g);
    if (!matches) return;

    for (let strNum of matches) {
        const num = parseInt(strNum, 10);

        if (num < minNum || num > maxNum) {
            showFeedback(`Dezena ${pad(num)} ignorada (fora do limite ${minNum}-${maxNum})`);
            continue;
        }

        if (currentDraftGame.includes(num)) {
            showFeedback(`Dezena ${pad(num)} ignorada (já adicionada)`);
            continue;
        }

        currentDraftGame.push(num);

        if (currentDraftGame.length === requiredSize) {
            currentDraftGame.sort((a, b) => a - b);
            const gameEntry = buildGameEntry(game.slug, [...currentDraftGame]);
            validGamesQueue.push(gameEntry);
            currentDraftGame = [];
            renderCompletedUI();
            showFeedback('✅ Jogo fechado!', false);
        }
    }

    currentDraftGame.sort((a, b) => a - b);
    renderDraftUI();
}

/**
 * Monta o objeto de jogo — array plano para loterias simples,
 * objeto JSON para loterias especiais.
 */
function buildGameEntry(slug, dezenas) {
    const rules = getRules(slug);

    if (rules.hasTrevos) {
        // +Milionária
        const trevos = [];
        if (panelTrevos) {
            panelTrevos.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
                trevos.push(parseInt(cb.value));
            });
        }
        const entry = { dezenas, trevos };
        entry.isManual = true;
        return entry;
    }

    if (rules.hasMonth) {
        // Dia de Sorte
        const mes = selectMonth ? parseInt(selectMonth.value) : 1;
        const entry = { dezenas, mes };
        entry.isManual = true;
        return entry;
    }

    if (rules.hasTeam) {
        // Timemania
        const time = selectTeam ? selectTeam.value : '';
        const entry = { dezenas, time };
        entry.isManual = true;
        return entry;
    }

    // Loteria padrão — array plano com flag
    const arr = [...dezenas];
    arr.isManual = true;
    return arr;
}

// ==========================================
// Importação de arquivo
// ==========================================
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const game = getSelectedGame();
    if (!game) { showFeedback('Selecione uma loteria primeiro.'); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = evt.target.result;
        const name = file.name.toLowerCase();

        if (name.endsWith('.csv') || name.endsWith('.txt')) {
            parseImportedText(data, game);
        } else if (window.XLSX) {
            try {
                const workbook = XLSX.read(data, { type: 'binary' });
                // Tenta usar a aba com o mesmo nome da loteria, ou a primeira
                const slugLower = game.slug.toLowerCase();
                const matchingSheet = workbook.SheetNames.find(n =>
                    n.toLowerCase().replace(/[^a-z]/g, '') === slugLower.replace(/[^a-z]/g, '')
                ) || workbook.SheetNames[0];

                const ws = workbook.Sheets[matchingSheet];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                parseImportedRows(rows, game);
            } catch (err) {
                showFeedback('Erro ao ler arquivo Excel.');
                console.error(err);
            }
        } else {
            showFeedback('Biblioteca Excel não carregada.');
        }
    };

    if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsBinaryString(file);
    }

    manualFileInput.value = '';
}

/**
 * Interpreta texto CSV/TXT estruturado.
 * Cada linha = um jogo. Ignora linhas com #.
 */
function parseImportedText(text, game) {
    const rules  = getRules(game.slug);
    const maxNum = game.parametros?.range_max ?? 60;
    const minNum = game.parametros?.range_min ?? 1;
    const lines  = text.split(/\r?\n/);
    let imported = 0;

    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;

        const parts = line.split(/[,;\t ]+/).map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) continue;

        // Primeira coluna pode ser índice/label do jogo — pula se não é número válido no range
        const firstNum = parseInt(parts[0]);
        const startIdx = (firstNum >= 1 && firstNum <= 9999 && firstNum > maxNum) ? 1 : 0;

        const nums = [];
        const extras = { trevos: [], mes: null, time: null };

        for (let i = startIdx; i < parts.length; i++) {
            const p = parts[i];
            const n = parseInt(p);

            if (rules.hasTrevos && i >= startIdx + rules.maxPick) {
                // Colunas de trevos
                if (!isNaN(n) && n >= 1 && n <= 6) extras.trevos.push(n);
            } else if (rules.hasMonth && i === parts.length - 1 && !isNaN(n) && n >= 1 && n <= 12) {
                extras.mes = n;
            } else if (rules.hasTeam && isNaN(n) && p.length > 2) {
                extras.time = p;
            } else if (!isNaN(n) && n >= minNum && n <= maxNum) {
                if (!nums.includes(n)) nums.push(n);
            }
        }

        if (nums.length < rules.minPick) continue;

        const dezenas = nums.slice(0, rules.maxPick).sort((a, b) => a - b);
        const entry = buildGameEntryFromData(game.slug, dezenas, extras);
        validGamesQueue.push(entry);
        imported++;
    }

    renderCompletedUI();
    if (imported > 0) showFeedback(`✅ ${imported} jogo(s) importado(s)!`, false);
    else showFeedback('Nenhum jogo válido encontrado no arquivo.');
}

/**
 * Interpreta linhas de planilha (arrays de valores).
 */
function parseImportedRows(rows, game) {
    const rules  = getRules(game.slug);
    const maxNum = game.parametros?.range_max ?? 60;
    const minNum = game.parametros?.range_min ?? 1;
    let imported = 0;

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        // Pula cabeçalho e comentários
        const firstCell = String(row[0] || '').trim();
        if (firstCell === '' || firstCell.startsWith('#') || firstCell.toLowerCase() === 'jogo') continue;

        const nums = [];
        const extras = { trevos: [], mes: null, time: null };

        for (let c = 1; c < row.length; c++) {
            const val = String(row[c] || '').trim();
            if (!val) continue;
            const n = parseInt(val);

            // Detecta coluna de trevo (cabeçalho contém "trevo")
            const header = rows[0] ? String(rows[0][c] || '').toLowerCase() : '';
            if (rules.hasTrevos && header.includes('trevo')) {
                if (!isNaN(n) && n >= 1 && n <= 6) extras.trevos.push(n);
            } else if (rules.hasMonth && header.includes('mes')) {
                if (!isNaN(n) && n >= 1 && n <= 12) extras.mes = n;
            } else if (rules.hasTeam && header.includes('time')) {
                if (isNaN(n) && val.length > 2) extras.time = val;
            } else if (!isNaN(n) && n >= minNum && n <= maxNum) {
                if (!nums.includes(n)) nums.push(n);
            }
        }

        if (nums.length < rules.minPick) continue;
        const dezenas = nums.slice(0, rules.maxPick).sort((a, b) => a - b);
        const entry = buildGameEntryFromData(game.slug, dezenas, extras);
        validGamesQueue.push(entry);
        imported++;
    }

    renderCompletedUI();
    if (imported > 0) showFeedback(`✅ ${imported} jogo(s) importado(s)!`, false);
    else showFeedback('Nenhum jogo válido encontrado no arquivo.');
}

function buildGameEntryFromData(slug, dezenas, extras) {
    const rules = getRules(slug);

    if (rules.hasTrevos) {
        const entry = { dezenas, trevos: extras.trevos.length >= 2 ? extras.trevos : [] };
        entry.isManual = true;
        return entry;
    }
    if (rules.hasMonth) {
        const entry = { dezenas, mes: extras.mes || 1 };
        entry.isManual = true;
        return entry;
    }
    if (rules.hasTeam) {
        const entry = { dezenas, time: extras.time || '' };
        entry.isManual = true;
        return entry;
    }
    const arr = [...dezenas];
    arr.isManual = true;
    return arr;
}

// ==========================================
// Renderização do rascunho atual
// ==========================================
function renderDraftUI() {
    const game = getSelectedGame();
    if (!game) return;

    const requiredSize = getSelectedQty();
    if (currentCountLabel) currentCountLabel.textContent = currentDraftGame.length;
    if (targetCountLabel)  targetCountLabel.textContent  = requiredSize;

    if (!draftContainer) return;

    if (currentDraftGame.length === 0) {
        draftContainer.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;width:100%;text-align:center;margin-top:20px;">Aguardando dezenas...</div>';
    } else {
        draftContainer.innerHTML = currentDraftGame.map(n => `
            <div style="background:var(--surface-3);border:1px solid var(--border-active);color:var(--text);border-radius:20px;padding:4px 12px;font-family:var(--font-num);font-size:1.1rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">
                ${pad(n)}
            </div>
        `).join('');
    }
}

// ==========================================
// Renderização da lista de jogos prontos
// ==========================================
function renderCompletedUI() {
    if (!validationList) return;

    if (validGamesQueue.length === 0) {
        validationList.innerHTML = '<div style="color:var(--text-3);text-align:center;margin-top:50px;">Nenhum jogo concluído ainda.</div>';
    } else {
        validationList.innerHTML = validGamesQueue.map((entry, index) => {
            const dezenas = Array.isArray(entry) ? entry : (entry.dezenas || []);
            const extras  = [];

            if (entry.trevos && entry.trevos.length > 0) {
                extras.push(`<span style="background:rgba(232,180,77,.15);color:var(--gold);border:1px solid var(--gold-border);border-radius:4px;padding:1px 6px;font-size:.72rem;font-weight:700;">🍀 Trevos: ${entry.trevos.join(', ')}</span>`);
            }
            if (entry.mes) {
                extras.push(`<span style="background:rgba(78,205,196,.12);color:var(--teal);border:1px solid var(--teal-border);border-radius:4px;padding:1px 6px;font-size:.72rem;font-weight:700;">📅 ${MONTHS[entry.mes] || entry.mes}</span>`);
            }
            if (entry.time) {
                extras.push(`<span style="background:rgba(109,213,117,.10);color:var(--green);border:1px solid var(--green-border);border-radius:4px;padding:1px 6px;font-size:.72rem;font-weight:700;">🏆 ${entry.time}</span>`);
            }

            return `
                <div style="padding:8px 12px;border-radius:var(--radius-sm);border-left:3px solid var(--green);background:rgba(0,0,0,.2);margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                        <span style="font-size:.8rem;color:var(--text-3);">Jogo ${index + 1} (${dezenas.length} dezenas)</span>
                        ${extras.join(' ')}
                    </div>
                    <div style="color:var(--text);font-family:var(--font-num);word-spacing:4px;">
                        ${dezenas.map(n => pad(n)).join(' ')}
                    </div>
                </div>
            `;
        }).join('');
    }

    validationList.scrollTop = validationList.scrollHeight;
    if (statsLabel) statsLabel.textContent = `${validGamesQueue.length} jogo(s) pronto(s)`;
    if (btnAddManual) btnAddManual.disabled = validGamesQueue.length === 0;
}

// ==========================================
// Adicionar jogos ao state e renderizar
// ==========================================
function addValidGames() {
    if (validGamesQueue.length === 0) return;

    const game = getSelectedGame();
    if (!game) return;
    const slug = game.slug;

    if (!state.currentGamesData[slug]) {
        state.currentGamesData[slug] = { games: [], selected: new Set(), page: 0 };
    }

    state.currentGamesData[slug].games.push(...validGamesQueue);

    renderGames();

    const qtyInput = document.getElementById(`qty-${slug}`);
    if (qtyInput) {
        qtyInput.value = (parseInt(qtyInput.value) || 0) + validGamesQueue.length;
    }

    import('./gerador.js').then(module => {
        if (module.updateSummary) module.updateSummary();
    });

    setTimeout(() => {
        const tabBtn = document.querySelector(`button[data-tab="tab-${slug}"]`);
        if (tabBtn) tabBtn.click();
    }, 50);

    const resultsArea = document.getElementById('results-area');
    if (resultsArea) resultsArea.classList.remove('hidden');

    document.getElementById('btn-automation-gen')?.classList.remove('hidden');
    document.getElementById('btn-register-bet-gen')?.classList.remove('hidden');

    const count = validGamesQueue.length;
    closeModal();

    const toastEl = document.getElementById('toast');
    if (toastEl) {
        document.getElementById('toast-msg').innerText = `${count} jogo(s) adicionado(s)!`;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 3000);
    }
}
