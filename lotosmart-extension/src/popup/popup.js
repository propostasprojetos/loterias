/**
 * LotoSmart Worker — Popup Controller
 * 
 * Controla a interface do popup da extensão:
 * - Consulta o status do Service Worker
 * - Exibe indicadores visuais de conexão e autenticação
 * - Gerencia o toggle de ativar/desativar o worker
 */

// ═══════════════════════════════════════════════════
// ELEMENTOS DO DOM
// ═══════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);

const els = {
  versionBadge:   $('version-badge'),
  statusDot:      $('status-dot'),
  statusText:     $('status-text'),
  authDot:        $('auth-dot'),
  authText:       $('auth-text'),
  statQueue:      $('stat-queue'),
  statDone:       $('stat-done'),
  statErrors:     $('stat-errors'),
  toggleWorker:   $('toggle-worker'),
  toggleHint:     $('toggle-hint'),
  linkDashboard:  $('link-dashboard'),
  linkLogs:       $('link-logs'),
};

// ═══════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await refreshStatus();
  setupListeners();
});

// ═══════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════

async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    if (!response) {
      setWorkerOffline();
      return;
    }

    // Versão
    els.versionBadge.textContent = `v${response.version}`;

    // Status do Worker
    if (response.workerActive) {
      els.statusDot.className = 'status-dot';
      els.statusText.textContent = 'Online';
    } else {
      setWorkerOffline();
    }

    // Autenticação
    if (response.authenticated) {
      els.authDot.className = 'status-dot';
      els.authText.textContent = 'Conectado';
      els.toggleWorker.disabled = false;
      els.toggleHint.textContent = 'O robô processará a fila automaticamente.';
    } else {
      els.authDot.className = 'status-dot offline';
      els.authText.textContent = 'Desconectado';
      els.toggleWorker.disabled = true;
      els.toggleHint.textContent = 'Faça login no painel para ativar.';
    }

    // Stats
    els.statQueue.textContent = response.queueLength ?? 0;

  } catch (err) {
    console.error('🎲 Popup: Erro ao consultar status', err);
    setWorkerOffline();
  }
}

function setWorkerOffline() {
  els.statusDot.className = 'status-dot offline';
  els.statusText.textContent = 'Offline';
  els.toggleWorker.disabled = true;
}

// ═══════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════

function setupListeners() {
  // Toggle do Worker
  els.toggleWorker.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.runtime.sendMessage({ type: 'SET_WORKER_ENABLED', enabled });
    els.toggleHint.textContent = enabled 
      ? 'O robô está processando a fila...' 
      : 'O robô está pausado.';
  });

  // Link do Dashboard (abre nova aba)
  els.linkDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://loterias-six.vercel.app/' });
  });

  // Link de Logs (abre a página de extensões)
  els.linkLogs.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions' });
  });
}
