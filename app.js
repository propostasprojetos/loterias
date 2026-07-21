// ==========================================
// app.js - Main Application Entry (Modular)
// ==========================================

import { $, $$, toast } from './js/utils.js';
import { initSupabase } from './js/supabase.js';
import { state } from './js/store.js';
import { loginUser, logoutUser, changePassword, checkAuthState } from './js/auth.js';
import { switchView, setupMobileMenu } from './js/ui.js';
import { generateAll, updateSummary } from './js/gerador.js';
import { handleAddBet, handleAddPrize, setFinFilter, refreshFinancialData } from './js/financeiro.js';
import { enqueueBetsForAutomation, clearAutomationQueue, resetAllFinancialData, refreshPendingPanel, initBetGamesRealtime } from './js/queue.js';
import { clearHistory } from './js/history.js';

// Mode Switching Logic
function setMode(mode) {
    state.generationMode = mode;
    updateModeUI();
    toast(`Modo ${mode} ativado`);
}

function updateModeUI() {
    $$('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.generationMode);
    });
}

function switchTab(tabId) {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.tab-content').forEach(x => x.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if(tabBtn) tabBtn.classList.add('active');
    const content = $(tabId);
    if(content) content.classList.add('active');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    // Nav & Menu
    setupMobileMenu();
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => {
        switchView(b.dataset.view);
        if (b.dataset.view === 'admin' && typeof window.refreshAdminData === 'function') {
            window.refreshAdminData();
        }
    }));
    
    // Gerador
    $('btn-generate')?.addEventListener('click', generateAll);
    $('btn-automation-gen')?.addEventListener('click', enqueueBetsForAutomation);
    $('btn-clear-queue-gen')?.addEventListener('click', clearAutomationQueue);
    $('btn-clear-queue-panel')?.addEventListener('click', clearAutomationQueue);
    $('btn-clear-history')?.addEventListener('click', clearHistory);
    $('btn-reset-all-data')?.addEventListener('click', resetAllFinancialData);
    
    // Config Modes
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Financeiro CRUD
    $('btn-add-bet')?.addEventListener('click', handleAddBet);
    $('btn-add-prize')?.addEventListener('click', handleAddPrize);

    // Filter Buttons logic (re-delegating to financeiro.js)
    $$('.fin-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.fin-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setFinFilter(btn.dataset.filter);
        });
    });

    // Auth Forms
    $('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const btn = $('btn-login-submit');
        if(!btn) return;
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        const res = await loginUser(email, password);
        btn.disabled = false;
        btn.textContent = 'Entrar';
        if (res.success) toast('Bem-vindo ao LotoSmart!');
        else toast(res.message);
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

        if (newPass.length < 8) return toast('A nova senha deve ter pelo menos 8 caracteres.');
        if (newPass !== confirmPass) return toast('As senhas não coincidem.');

        if(btn) { btn.disabled = true; btn.textContent = 'Alterando...'; }
        const res = await changePassword(oldPass, newPass);
        if(btn) { btn.disabled = false; btn.textContent = 'Alterar Senha'; }
        
        if (res.success) toast('Senha alterada com sucesso!');
        else toast(res.message);
    });

    // Contato Form
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

    // Set default dates
    const today = new Date().toISOString().slice(0, 10);
    if ($('fin-bet-date')) $('fin-bet-date').value = today;
    if ($('fin-prize-date')) $('fin-prize-date').value = today;

    updateSummary();
    updateModeUI();

    // Init Core
    initSupabase().then(async () => {
        await checkAuthState();
        if (state.currentSession && (!state.currentProfile || !state.currentProfile.must_change_password)) {
            refreshFinancialData();
            initBetGamesRealtime();
            await refreshPendingPanel();
        }
    });
});
