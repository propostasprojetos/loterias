// ==========================================
// ui.js - UI Navigation and Interactions
// ==========================================

import { $ } from './utils.js';

export function switchView(viewId) {
    document.querySelectorAll('section[id^="view-"]').forEach(v => {
        v.classList.add('hidden');
        v.style.display = 'none';
    });
    
    const target = $('view-' + viewId);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block';
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.id === 'nav-btn-' + viewId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Fechar menu mobile se estiver aberto
    const sidebar = $('sidebar');
    const overlay = $('mobile-overlay');
    if (window.innerWidth <= 768 && sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

// Configuração do menu mobile
export function setupMobileMenu() {
    const btn = $('mobile-menu-btn');
    const sidebar = $('sidebar');
    const overlay = $('mobile-overlay');

    if (btn && sidebar && overlay) {
        btn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
}
