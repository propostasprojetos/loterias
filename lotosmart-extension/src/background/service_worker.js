/**
 * LotoSmart Worker — Service Worker (Background)
 * 
 * Entrypoint do background da extensão. Na Fase 1 ele é um esqueleto
 * mínimo que apenas registra sua inicialização e escuta mensagens
 * externas do Dashboard Web (para receber a sessão futuramente).
 * 
 * A lógica de fila, Supabase e orquestração será adicionada nas fases seguintes.
 */

import { createLogger } from '../shared/logger.js';
import { WORKER_VERSION } from '../shared/config.js';
import * as db from './supabase.js';

const log = createLogger('ServiceWorker');

// ═══════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener((details) => {
  log.info(`Extensão instalada (v${WORKER_VERSION})`, { reason: details.reason });
});

chrome.runtime.onStartup.addListener(() => {
  log.info('Service Worker iniciado');
});

// ═══════════════════════════════════════════════════
// MENSAGENS EXTERNAS (Dashboard Web → Extensão)
// ═══════════════════════════════════════════════════

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  log.info('Mensagem externa recebida', { type: message?.type, origin: sender?.origin });

  if (message?.type === 'PING') {
    sendResponse({ status: 'ok', version: WORKER_VERSION });
    return;
  }

  // Recebe e armazena a sessão (Fase 2)
  if (message?.type === 'LOTOSMART_SESSION_SYNC') {
    log.info('Sessão recebida do Dashboard Web');
    
    // Armazena no chrome.storage local
    chrome.storage.local.set({ supabaseSession: message.session }, () => {
      // Passa para o SDK do Supabase inicializar
      db.setSessionFromWeb(message.session)
        .then(() => {
          log.info('Sessão aplicada ao SDK Supabase');
          sendResponse({ status: 'session_stored' });
        })
        .catch(err => {
          log.error('Erro ao aplicar sessão no SDK', err);
          sendResponse({ status: 'error', message: err.message });
        });
    });
    return true; // Keep channel open for async
  }

  sendResponse({ status: 'unknown_message' });
});

// ═══════════════════════════════════════════════════
// MENSAGENS INTERNAS (Popup ↔ Background)
// ═══════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_STATUS') {
    // Check auth directly via SDK
    db.isAuthenticated().then(isAuthenticated => {
      sendResponse({
        version: WORKER_VERSION,
        workerActive: true, // TODO: sync with queue_manager state
        authenticated: isAuthenticated,
        queueLength: 0, // Será dinâmico quando integrarmos a fila
      });
    });
    return true; // keep channel open for async
  }

  if (message?.type === 'SET_WORKER_ENABLED') {
    import('./queue_manager.js').then(queue => {
      if (message.enabled) {
        queue.startWorker();
      } else {
        queue.stopWorker();
      }
    });
    sendResponse({ status: 'ok' });
  }
});

log.info(`Service Worker carregado (v${WORKER_VERSION})`);
