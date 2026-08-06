/**
 * LotoSmart Worker — Dashboard Sync Content Script
 *
 * Executa nas páginas do LotoSmart Dashboard (Vercel/Localhost).
 * Lê a sessão do Supabase no localStorage da página e envia ao
 * background da extensão automaticamente, sem depender de mensagem externa.
 *
 * A chave do localStorage é gerada pelo SDK do Supabase no formato:
 * sb-<project-ref>-auth-token
 */

const SUPABASE_STORAGE_KEY = 'sb-klrivylidketfbaakbil-auth-token';
let lastSessionHash = null;

function extractSession() {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // O SDK pode salvar diretamente o objeto de sessão ou em um wrapper
    const session = parsed?.access_token ? parsed : (parsed?.currentSession ?? null);

    if (!session?.access_token || !session?.refresh_token) return null;
    return session;
  } catch (e) {
    return null;
  }
}

function sendSessionToBackground(session) {
  chrome.runtime.sendMessage(
    { type: 'LOTOSMART_SESSION_SYNC', session },
    (response) => {
      if (chrome.runtime.lastError) {
        // Silencia — pode acontecer se o background ainda está carregando
        return;
      }
      if (session) {
        console.log('🎲 LotoSmart: Sessão sincronizada com a extensão!', response);
      } else {
        console.log('🎲 LotoSmart: Logout detectado, extensão notificada.');
      }
    }
  );
}

function checkAndSync() {
  const session = extractSession();
  const hash = session ? session.access_token : 'null';

  if (hash !== lastSessionHash) {
    lastSessionHash = hash;
    console.log('🎲 LotoSmart: Mudança de sessão detectada, sincronizando...');
    sendSessionToBackground(session);
  }
}

// --- Inicialização ---

// Verifica na carga inicial da página
checkAndSync();

// Monitora alterações a cada 3 segundos
setInterval(checkAndSync, 3000);

// Também monitora o evento de storage (para capturar login/logout na mesma aba)
window.addEventListener('storage', (e) => {
  if (e.key === SUPABASE_STORAGE_KEY) {
    console.log('🎲 LotoSmart: Evento storage detectado, re-sincronizando...');
    lastSessionHash = null; // Força re-sync
    checkAndSync();
  }
});
