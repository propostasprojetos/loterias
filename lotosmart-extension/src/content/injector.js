/**
 * LotoSmart Worker — Content Script Injector (Esqueleto)
 * 
 * Injetado automaticamente nas páginas da Caixa Econômica.
 * Na Fase 1 ele apenas registra sua presença. A lógica de cliques
 * será implementada na Fase 4.
 */

console.log('🎲 LotoSmart Worker: Content Script carregado na Caixa');

// ═══════════════════════════════════════════════════
// LISTENER DE MENSAGENS (Background → Content Script)
// ═══════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🎲 LotoSmart Worker: Mensagem recebida', message);

  if (message?.type === 'PING') {
    sendResponse({ status: 'content_script_ready' });
    return;
  }

  // Placeholder para Fase 4 (executar automação)
  if (message?.type === 'EXECUTE_GAME') {
    sendResponse({ status: 'not_implemented_yet' });
    return;
  }
});
