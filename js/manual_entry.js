import { state } from './store.js';
import { renderGames } from './gerador.js';
import { pad } from './utils.js';

// DOM Elements
const btnManualEntry = document.getElementById('btn-manual-entry');
const modalManual = document.getElementById('manual-modal');
const btnCloseManual = document.getElementById('btn-close-manual-modal');
const btnCancelManual = document.getElementById('btn-cancel-manual');
const btnAddManual = document.getElementById('btn-add-manual');

const gameSelect = document.getElementById('manual-game-select');
const numberInput = document.getElementById('manual-number-input');
const btnManualUpload = document.getElementById('btn-manual-upload');
const manualFileInput = document.getElementById('manual-file-input');
const feedbackLabel = document.getElementById('manual-feedback');
const currentCountLabel = document.getElementById('manual-current-count');
const targetCountLabel = document.getElementById('manual-target-count');
const draftContainer = document.getElementById('manual-draft-container');
const draftEmpty = document.getElementById('manual-draft-empty');
const btnClearDraft = document.getElementById('btn-clear-draft');
const validationList = document.getElementById('manual-validation-list');
const statsLabel = document.getElementById('manual-stats');

let validGamesQueue = [];
let currentDraftGame = [];
let feedbackTimeout;

// Event Listeners
if (btnManualEntry) btnManualEntry.addEventListener('click', openModal);
if (btnCloseManual) btnCloseManual.addEventListener('click', closeModal);
if (btnCancelManual) btnCancelManual.addEventListener('click', closeModal);
if (btnAddManual) btnAddManual.addEventListener('click', addValidGames);

if (gameSelect) gameSelect.addEventListener('change', resetCurrentGame);
if (btnClearDraft) btnClearDraft.addEventListener('click', () => { currentDraftGame = []; renderDraftUI(); });
if (btnManualUpload) btnManualUpload.addEventListener('click', () => manualFileInput && manualFileInput.click());
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
        if (pasteData) {
            processInputText(pasteData);
        }
    });
}

function openModal() {
    if (!state.activeGames || state.activeGames.length === 0) {
        alert('Nenhum jogo ativo encontrado. Peça para o administrador liberar os jogos para você.');
        return;
    }
    
    if (gameSelect) {
        gameSelect.innerHTML = state.activeGames.map(g => `<option value="${g.slug}">${g.nome}</option>`).join('');
    }
    
    validGamesQueue = [];
    currentDraftGame = [];
    resetCurrentGame();
    
    modalManual.classList.remove('hidden');
    numberInput.focus();
}

function closeModal() {
    modalManual.classList.add('hidden');
}

function getSelectedGame() {
    const slug = gameSelect.value;
    return state.activeGames.find(g => g.slug === slug);
}

function resetCurrentGame() {
    currentDraftGame = [];
    renderDraftUI();
    renderCompletedUI();
}

function showFeedback(msg) {
    feedbackLabel.textContent = msg;
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => { feedbackLabel.textContent = ''; }, 3000);
}

function processInputText(text) {
    const game = getSelectedGame();
    if (!game) return;

    const requiredSize = game.parametros?.pick_size || 15;
    const maxNum = game.parametros?.range_max || 25;
    const minNum = game.parametros?.range_min || 1;

    // Extrai todos os números usando regex
    const matches = text.match(/\d+/g);
    if (!matches) return;

    for (let strNum of matches) {
        const num = parseInt(strNum, 10);

        if (num < minNum || num > maxNum) {
            showFeedback(`Dezena ${pad(num)} ignorada (fora do limite ${minNum}-${maxNum})`);
            continue;
        }

        if (currentDraftGame.includes(num)) {
            showFeedback(`Dezena ${pad(num)} ignorada (já foi adicionada)`);
            continue;
        }

        currentDraftGame.push(num);

        if (currentDraftGame.length === requiredSize) {
            // Jogo concluído
            currentDraftGame.sort((a, b) => a - b);
            validGamesQueue.push([...currentDraftGame]);
            currentDraftGame = []; // reset
            renderCompletedUI();
            showFeedback('Jogo fechado e adicionado à lista!');
        }
    }
    
    currentDraftGame.sort((a, b) => a - b);
    renderDraftUI();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = evt.target.result;
        const name = file.name.toLowerCase();
        
        if (name.endsWith('.csv') || name.endsWith('.txt')) {
            processInputText(data);
        } else {
            // Tentativa de leitura de Excel via SheetJS (XLSX) global
            if (window.XLSX) {
                try {
                    const workbook = XLSX.read(data, { type: 'binary' });
                    let fullText = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const rowData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                        rowData.forEach(row => {
                            fullText += row.join(' ') + ' ';
                        });
                    });
                    processInputText(fullText);
                } catch (err) {
                    showFeedback('Erro ao ler arquivo Excel.');
                    console.error(err);
                }
            } else {
                showFeedback('Biblioteca de Excel não carregada.');
            }
        }
    };

    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    manualFileInput.value = '';
}

function renderDraftUI() {
    const game = getSelectedGame();
    if (!game) return;

    const requiredSize = game.parametros?.pick_size || 15;
    currentCountLabel.textContent = currentDraftGame.length;
    targetCountLabel.textContent = requiredSize;

    if (currentDraftGame.length === 0) {
        draftContainer.innerHTML = '<div style="color: var(--text-3); font-size: 0.85rem; width: 100%; text-align: center; margin-top: 20px;">Aguardando dezenas...</div>';
    } else {
        draftContainer.innerHTML = currentDraftGame.map(n => `
            <div style="background: var(--surface-3); border: 1px solid var(--border-active); color: var(--text); border-radius: 20px; padding: 4px 12px; font-family: var(--font-num); font-size: 1.1rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;">
                ${pad(n)}
            </div>
        `).join('');
    }
}

function renderCompletedUI() {
    if (validGamesQueue.length === 0) {
        validationList.innerHTML = '<div style="color: var(--text-3); text-align: center; margin-top: 50px;">Nenhum jogo concluído ainda.</div>';
    } else {
        validationList.innerHTML = validGamesQueue.map((gameArr, index) => `
            <div style="padding: 8px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--green); background: rgba(0,0,0,0.2); margin-bottom: 8px;">
                <div style="font-size: 0.8rem; color: var(--text-3); margin-bottom: 4px;">Jogo ${index + 1} (${gameArr.length} dezenas)</div>
                <div style="color: var(--text); font-family: var(--font-num); word-spacing: 4px;">
                    ${gameArr.map(n => pad(n)).join(' ')}
                </div>
            </div>
        `).join('');
    }
    
    // Scroll to bottom
    validationList.scrollTop = validationList.scrollHeight;

    statsLabel.textContent = `${validGamesQueue.length} jogo(s) pronto(s)`;
    btnAddManual.disabled = validGamesQueue.length === 0;
}

function addValidGames() {
    if (validGamesQueue.length === 0) return;
    
    const game = getSelectedGame();
    if (!game) return;
    const slug = game.slug;
    
    if (!state.currentGamesData[slug]) {
        state.currentGamesData[slug] = { games: [], selected: new Set(), page: 0 };
    }

    const newGames = validGamesQueue.map(arr => {
        arr.isManual = true;
        return arr;
    });

    state.currentGamesData[slug].games.push(...newGames);

    renderGames();
    
    const qtyInput = document.getElementById(`qty-${slug}`);
    if (qtyInput) {
        qtyInput.value = (parseInt(qtyInput.value) || 0) + newGames.length;
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
    
    const btnAuto = document.getElementById('btn-automation-gen');
    if (btnAuto) btnAuto.classList.remove('hidden');
    
    const btnReg = document.getElementById('btn-register-bet-gen');
    if (btnReg) btnReg.classList.remove('hidden');

    closeModal();
    
    const toastMsg = document.getElementById('toast');
    if (toastMsg) {
        document.getElementById('toast-msg').innerText = `${newGames.length} jogo(s) adicionado(s)!`;
        toastMsg.classList.add('show');
        setTimeout(() => toastMsg.classList.remove('show'), 3000);
    }
}

