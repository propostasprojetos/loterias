/**
 * LotoSmart Worker — Content Script Injector
 * 
 * Injetado automaticamente nas páginas da Caixa Econômica.
 * Atua como ponte entre o Background (Service Worker) e os scripts de automação da DOM.
 */

console.log('🎲 LotoSmart Worker: Content Script carregado na Caixa');

let lotofacilModule = null;

// Inicializa os módulos ES6 usando importação dinâmica
(async () => {
  try {
    const url = chrome.runtime.getURL("src/content/lotofacil.js");
    lotofacilModule = await import(url);
    console.log('🎲 LotoSmart Worker: Módulos de automação carregados com sucesso');
  } catch (err) {
    console.error('🎲 LotoSmart Worker: Falha ao carregar módulos', err);
  }
})();

// ═══════════════════════════════════════════════════
// LISTENER DE MENSAGENS (Background → Content Script)
// ═══════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🎲 LotoSmart Worker: Mensagem recebida', message);

  if (message?.type === 'PING') {
    sendResponse({ status: 'content_script_ready' });
    return;
  }

  if (message?.type === 'EXECUTE_JOB') {
    const { bet, games } = message;

    if (!lotofacilModule) {
      sendResponse({ status: 'error', message: 'Módulos não carregados' });
      return;
    }

    if (bet.lottery_type === 'lotofacil') {
      // Verifica se a URL está correta
      if (!window.location.hash.includes('#/lotofacil')) {
        sendResponse({ status: 'error', message: 'wrong_page' });
        return;
      }

      // Executa assincronamente e retorna depois
      lotofacilModule.executeAllGames(games).then(results => {
        sendResponse({ status: 'success', results });
      }).catch(err => {
        sendResponse({ status: 'error', message: err.message });
      });

      return true; // Mantém o canal aberto para a resposta assíncrona
    }

    sendResponse({ status: 'error', message: 'Loteria não suportada' });
    return;
  }
});
