// ==========================================
// utils.js - Shared Utilities & UI Helpers
// ==========================================

export const $ = id => document.getElementById(id);
export const $$ = sel => document.querySelectorAll(sel);
export const pad = n => n.toString().padStart(2, '0');
export const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Attach globals for older scripts / console debugging if needed
window.$ = $;
window.$$ = $$;
window.pad = pad;
window.fmt = fmt;

export const ICON = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>`
};

export function randomInt(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { 
        const j = randomInt(0, i);
        [a[i], a[j]] = [a[j], a[i]]; 
    }
    return a;
}

export function countEven(n) { 
    return n.filter(x => x % 2 === 0).length; 
}

export function maxConsec(nums) {
    const s = [...nums].sort((a, b) => a - b);
    let mx = 1, c = 1;
    for (let i = 1; i < s.length; i++) { 
        if (s[i] === s[i - 1] + 1) { 
            c++; mx = Math.max(mx, c); 
        } else {
            c = 1;
        }
    }
    return mx;
}

export function intersect(a, b) { 
    return a.filter(n => b.includes(n)); 
}

export function renderBall(n, slug) {
    const isEven = n % 2 === 0;
    const isQn = slug === 'quina';
    return `<div class="ball ${isEven ? 'even' : 'odd'} ${isQn ? 'qn' : ''}">${pad(n)}</div>`;
}

// ===== TOAST =====
export function toast(msg, type = 'info', pos = 'bottom') {
    const el = $('toast');
    if(!el) return;
    el.className = 'toast'; // Reset classes
    if (type === 'success') el.classList.add('success');
    if (pos === 'top-right') el.classList.add('top-right');
    $('toast-msg').textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
}
window.toast = toast; // Keeps globally available for simple onClick bindings in HTML

// ===== PREMIUM CONFIRM DIALOG =====
export function showConfirm(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center; border-color: var(--border-active);">
            <div class="modal-header" style="justify-content: center; margin-bottom: 14px;">
                <h2 style="font-size: 1.2rem; color: var(--gold); margin: 0;">${title}</h2>
            </div>
            <p style="color: var(--text-2); font-size: 0.85rem; margin-bottom: 24px; line-height: 1.5; white-space: pre-line;">
                ${message}
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="confirm-cancel-btn" class="btn-secondary" style="margin: 0; padding: 10px 20px; flex: 1;">Cancelar</button>
                <button id="confirm-ok-btn" class="btn-primary" style="margin: 0; padding: 10px 20px; flex: 1;">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.style.opacity = '1', 20);

    const cleanup = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector('#confirm-cancel-btn').onclick = cleanup;
    overlay.querySelector('#confirm-ok-btn').onclick = () => {
        cleanup();
        onConfirm();
    };
}
window.showConfirm = showConfirm;
