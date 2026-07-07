import { state } from './store.js';
import { renderGames } from './gerador.js';

// DOM Elements
const btnManualEntry = document.getElementById('btn-manual-entry');
const modalManual = document.getElementById('manual-modal');
const btnCloseManual = document.getElementById('btn-close-manual-modal');
const btnCancelManual = document.getElementById('btn-cancel-manual');
const btnAddManual = document.getElementById('btn-add-manual');
const textarea = document.getElementById('manual-textarea');
const validationList = document.getElementById('manual-validation-list');
const statsLabel = document.getElementById('manual-stats');
const gameSelect = document.getElementById('manual-game-select');

let validGamesQueue = [];

// Event Listeners
if (btnManualEntry) {
    btnManualEntry.addEventListener('click', openModal);
}
if (btnCloseManual) btnCloseManual.addEventListener('click', closeModal);
if (btnCancelManual) btnCancelManual.addEventListener('click', closeModal);
if (btnAddManual) btnAddManual.addEventListener('click', addValidGames);

if (textarea) {
    textarea.addEventListener('input', debounce(validateInput, 300));
}
if (gameSelect) {
    gameSelect.addEventListener('change', validateInput);
}

function openModal() {
    if (!state.activeGames || state.activeGames.length === 0) {
        alert('Nenhum jogo ativo encontrado. Peça para o administrador liberar os jogos para você.');
        return;
    }
    
    // Preenche o seletor de jogos
    if (gameSelect) {
        gameSelect.innerHTML = state.activeGames.map(g => `<option value="${g.slug}">${g.nome}</option>`).join('');
    }
    
    textarea.value = '';
    validGamesQueue = [];
    updateValidationUI();
    
    modalManual.classList.remove('hidden');
    textarea.focus();
}

function closeModal() {
    modalManual.classList.add('hidden');
}

/**
 * Retorna o objeto do jogo selecionado no momento
 */
function getSelectedGame() {
    const slug = gameSelect.value;
    return state.activeGames.find(g => g.slug === slug);
}

/**
 * Valida o texto digitado/colado em tempo real
 */
function validateInput() {
    const text = textarea.value;
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    validGamesQueue = [];
    validationList.innerHTML = '';
    
    if (lines.length === 0) {
        updateValidationUI();
        return;
    }

    const game = getSelectedGame();
    if (!game) return;

    // A quantidade exigida é a parametrizada no jogo base (pick)
    const requiredSize = game.parametros?.pick_size || 15; // fallback
    const maxNum = game.parametros?.range_max || 25;
    const minNum = game.parametros?.range_min || 1;

    let validCount = 0;

    lines.forEach((line, index) => {
        // Extrai apenas os números da linha (separa por vírgula, espaço, traço etc)
        const numbersMatch = line.match(/\d+/g);
        
        const lineEl = document.createElement('div');
        lineEl.style.padding = '6px 8px';
        lineEl.style.borderRadius = '4px';
        lineEl.style.borderLeft = '3px solid transparent';
        lineEl.style.background = 'rgba(0,0,0,0.2)';
        
        if (!numbersMatch) {
            lineEl.style.borderLeftColor = 'var(--red)';
            lineEl.innerHTML = `<span style="color:var(--text-3)">L${index+1}:</span> <span style="color:var(--red)">Nenhum número encontrado</span>`;
            validationList.appendChild(lineEl);
            return;
        }

        // Converte pra inteiro e remove duplicatas
        const numbers = [...new Set(numbersMatch.map(n => parseInt(n, 10)))].sort((a, b) => a - b);
        
        // Validações
        if (numbers.length !== requiredSize) {
            lineEl.style.borderLeftColor = 'var(--red)';
            lineEl.innerHTML = `<span style="color:var(--text-3)">L${index+1}:</span> <span style="color:var(--red)">Tem ${numbers.length} dezenas (precisa de ${requiredSize})</span>`;
        } else if (numbers[0] < minNum || numbers[numbers.length - 1] > maxNum) {
            lineEl.style.borderLeftColor = 'var(--red)';
            lineEl.innerHTML = `<span style="color:var(--text-3)">L${index+1}:</span> <span style="color:var(--red)">Números fora do limite (${minNum}-${maxNum})</span>`;
        } else {
            // Válido!
            lineEl.style.borderLeftColor = 'var(--green)';
            lineEl.innerHTML = `<span style="color:var(--text-3)">L${index+1}:</span> <span style="color:var(--green)">Válido (${requiredSize} dezenas)</span>`;
            validGamesQueue.push(numbers);
            validCount++;
        }
        
        validationList.appendChild(lineEl);
    });

    // Scroll to bottom
    validationList.scrollTop = validationList.scrollHeight;

    statsLabel.textContent = `${validCount} jogo(s) válido(s) encontrado(s)`;
    btnAddManual.disabled = validCount === 0;
}

function updateValidationUI() {
    validationList.innerHTML = '<div style="color: var(--text-3); text-align: center; margin-top: 50px;">Aguardando digitação...</div>';
    statsLabel.textContent = '0 jogos válidos encontrados';
    btnAddManual.disabled = true;
}

/**
 * Adiciona os jogos validados à store global e atualiza a interface
 */
function addValidGames() {
    if (validGamesQueue.length === 0) return;
    
    const game = getSelectedGame();
    if (!game) return;
    const slug = game.slug;
    
    // Garante que o objeto do jogo existe no state
    if (!state.currentGamesData[slug]) {
        state.currentGamesData[slug] = { games: [], selected: new Set(), page: 0 };
    }

    // Cria o objeto no mesmo formato do gerador (arrays de inteiros)
    const newGames = validGamesQueue.map(arr => {
        arr.isManual = true; // tag útil para diferenciar visualmente, mantendo a estrutura de Array
        return arr;
    });

    // Adiciona no final
    state.currentGamesData[slug].games.push(...newGames);

    // Re-renderiza a tela de resultados
    renderGames();
    
    // Atualiza o input de quantidade para refletir a soma manual + gerada
    const qtyInput = document.getElementById(`qty-${slug}`);
    if (qtyInput) {
        qtyInput.value = (parseInt(qtyInput.value) || 0) + newGames.length;
    }
    
    // Atualiza o resumo financeiro com a nova quantidade e dispara a prop de total
    import('./gerador.js').then(module => {
        if (module.updateSummary) module.updateSummary();
    });
    
    // Força a ativação da aba do jogo recém inserido
    setTimeout(() => {
        const tabBtn = document.querySelector(`button[data-tab="tab-${slug}"]`);
        if (tabBtn) tabBtn.click();
    }, 50);
    
    // Mostra as abas e paineis se estavam escondidos (primeira geração)
    const resultsArea = document.getElementById('results-area');
    if (resultsArea) resultsArea.classList.remove('hidden');
    
    const btnAuto = document.getElementById('btn-automation-gen');
    if (btnAuto) btnAuto.classList.remove('hidden');
    
    const btnReg = document.getElementById('btn-register-bet-gen');
    if (btnReg) btnReg.classList.remove('hidden');

    // Fecha o modal
    closeModal();
    
    // Feedback visual
    const toast = document.getElementById('toast');
    if (toast) {
        document.getElementById('toast-msg').innerText = `${newGames.length} jogo(s) manual(is) adicionado(s)!`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Utilitário de Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

