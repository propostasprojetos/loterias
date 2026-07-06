// ==========================================
// auth.js - Authentication Module
// ==========================================

import { supabaseClient, sbReady } from './supabase.js';
import { state } from './store.js';
import { toast, $ } from './utils.js';
import { switchView } from './ui.js';
import { loadAvailableGames } from './gerador.js';

export async function loginUser(email, password) {
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

export async function logoutUser() {
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await logAudit('logout', session.user.id, {});
        }
        await supabaseClient.auth.signOut();
    }
    state.currentSession = null;
    state.currentProfile = null;
    await checkAuthState();
}

export async function changePassword(oldPass, newPass) {
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

// Audit logs
export async function logAudit(action, userId, details = {}) {
    if (!sbReady) return;
    try {
        await supabaseClient.from('audit_logs').insert({
            user_id: userId,
            action: action,
            details: details,
            ip_address: null 
        });
    } catch (e) {
        console.error('Audit log failed:', e);
    }
}

let isAuthChecking = false;
export async function checkAuthState() {
    if (isAuthChecking) return;
    isAuthChecking = true;

    try {
        if (!sbReady) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        state.currentSession = session;
        window.currentSession = session;
        state.currentProfile = null;
        window.currentProfile = null;

        if (session) {
            const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
            if (!error && profile) {
                state.currentProfile = profile;
                window.currentProfile = profile;
            }
            
            const { data: isSuper } = await supabaseClient.rpc('is_super_admin', { _user_id: session.user.id });
            window.isSuperAdmin = !!isSuper;
        } else {
            window.isSuperAdmin = false;
        }

        const user = state.currentSession ? state.currentSession.user : null;
        const profile = state.currentProfile;

        if (profile && profile.ativo === false) {
            await supabaseClient.auth.signOut();
            state.currentSession = null;
            window.currentSession = null;
            state.currentProfile = null;
            window.currentProfile = null;
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
        const userMenu = $('user-menu');
        const headerUserName = $('header-user-name');

        if (!state.currentSession) {
            window.currentSession = null;
            if(navGerador) navGerador.style.display = 'none';
            if(navHistorico) navHistorico.style.display = 'none';
            if(navFinanceiro) navFinanceiro.style.display = 'none';
            if(navAdmin) navAdmin.style.display = 'none';
            if(userMenu) userMenu.style.display = 'none';
            state.activeGames = [];
            state.currentGamesData = {};
            const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
            if (!currentView || (currentView.id !== 'view-login' && currentView.id !== 'view-contato')) {
                switchView('login');
            }
        } else {
            if(userMenu) userMenu.style.display = 'flex';
            if(headerUserName) headerUserName.textContent = (profile && profile.name) || user.email;

            if (profile && profile.must_change_password) {
                if(navGerador) navGerador.style.display = 'none';
                if(navHistorico) navHistorico.style.display = 'none';
                if(navFinanceiro) navFinanceiro.style.display = 'none';
                if(navAdmin) navAdmin.style.display = 'none';
                switchView('change-password');
            } else {
                if(navGerador) navGerador.style.display = 'inline-block';
                if(navHistorico) navHistorico.style.display = 'inline-block';
                if(navFinanceiro) navFinanceiro.style.display = 'inline-block';
                
                if (window.isSuperAdmin) {
                    if(navAdmin) {
                        navAdmin.style.display = 'inline-block';
                        navAdmin.classList.remove('hidden');
                    }
                } else {
                    if(navAdmin) {
                        navAdmin.style.display = 'none';
                        navAdmin.classList.add('hidden');
                    }
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
