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
// O Dashboard enviará a sessão do Supabase via chrome.runtime.sendMessage(extensionId, ...)
// Isso será implementado na Fase 2.

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  log.info('Mensagem externa recebida', { type: message?.type, origin: sender?.origin });

  if (message?.type === 'PING') {
    sendResponse({ status: 'ok', version: WORKER_VERSION });
    return;
  }

  // Placeholder para Fase 2 (receber sessão)
  sendResponse({ status: 'unknown_message' });
});

// ═══════════════════════════════════════════════════
// MENSAGENS INTERNAS (Popup ↔ Background)
// ═══════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_STATUS') {
    sendResponse({
      version: WORKER_VERSION,
      workerActive: true,
      authenticated: false,   // Será dinâmico na Fase 3
      queueLength: 0,         // Será dinâmico na Fase 3
    });
    return true; // keep channel open for async
  }
});

log.info(`Service Worker carregado (v${WORKER_VERSION})`);
