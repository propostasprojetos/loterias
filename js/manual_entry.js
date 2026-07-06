import { state } from './store.js';
import { renderGameTabs } from './gerador.js';

// DOM Elements
const btnManualEntry = document.getElementById('btn-manual-entry');
const modalManual = document.getElementById('manual-modal');
const btnCloseManual = document.getElementById('btn-close-manual-modal');
const btnCancelManual = document.getElementById('btn-cancel-manual');
const btnAddManual = document.getElementById('btn-add-manual');
const textarea = document.getElementById('manual-textarea');
const validationList = document.getElementById('manual-validation-list');
const statsLabel = document.getElementById('manual-stats');
const gameNameLabel = document.getElementById('manual-game-name');

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

function openModal() {
    if (!state.currentGame) return;
    
    // Configura os textos do modal
    gameNameLabel.textContent = state.currentGame.name;
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

    const game = state.currentGame;
    // Pega a quantidade selecionada no seletor de dezenas do painel principal (se existir), senão pega o padrão
    const requiredSize = state.budget[game.slug]?.pick || game.pick;
    const maxNum = game.range_max;
    const minNum = game.range_min;

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
    
    const slug = state.currentGame.slug;
    
    // Garante que o objeto do jogo existe no state
    if (!state.currentGamesData[slug]) {
        state.currentGamesData[slug] = { games: [], selected: new Set(), page: 0 };
    }

    // Cria o objeto no mesmo formato do gerador
    const newGames = validGamesQueue.map(arr => ({
        numbers: arr,
        id: crypto.randomUUID(),
        isManual: true // tag útil para diferenciar visualmente (opcional)
    }));

    // Adiciona no final
    state.currentGamesData[slug].games.push(...newGames);

    // Re-renderiza a tela de resultados
    renderGameTabs();
    
    // Mostra as abas e paineis se estavam escondidos (primeira geração)
    document.getElementById('results-area').classList.remove('hidden');
    document.getElementById('btn-automation-gen').classList.remove('hidden');
    document.getElementById('btn-register-bet-gen').classList.remove('hidden');

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
