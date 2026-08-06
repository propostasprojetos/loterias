/**
 * LotoSmart Worker — Dashboard Sync Content Script
 *
 * Executa nas páginas do LotoSmart Dashboard (Vercel/Localhost).
 * Lê a sessão do Supabase no localStorage da página e envia ao
 * background da extensão automaticamente.
 */

const SUPABASE_STORAGE_KEY = 'sb-klrivylidketfbaakbil-auth-token';
let lastSessionHash = null;

console.log('🎲 LotoSmart: dashboard_sync.js injetado com sucesso na página!');

function extractSession() {
  try {
    // Tenta a chave padrão primeiro
    let raw = localStorage.getItem(SUPABASE_STORAGE_KEY);

    // Se não encontrou, varre todo o localStorage em busca de chave Supabase
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          console.log('🎲 LotoSmart: Chave Supabase encontrada dinamicamente:', k);
          raw = localStorage.getItem(k);
          break;
        }
      }
    }

    if (!raw) {
      console.log('🎲 LotoSmart: Nenhuma sessão encontrada no localStorage.');
      return null;
    }

    const parsed = JSON.parse(raw);

    // O SDK salva diretamente o objeto de sessão (access_token na raiz)
    const session = parsed?.access_token ? parsed : (parsed?.currentSession ?? null);

    if (!session?.access_token || !session?.refresh_token) {
      console.warn('🎲 LotoSmart: Sessão encontrada mas inválida (sem access_token/refresh_token):', Object.keys(parsed));
      return null;
    }

    console.log('🎲 LotoSmart: Sessão válida encontrada! User:', session?.user?.email ?? 'desconhecido');
    return session;
  } catch (e) {
    console.error('🎲 LotoSmart: Erro ao extrair sessão:', e);
    return null;
  }
}

function sendSessionToBackground(session) {
  chrome.runtime.sendMessage(
    { type: 'LOTOSMART_SESSION_SYNC', session },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn('🎲 LotoSmart: Erro ao enviar sessão para background:', chrome.runtime.lastError.message);
        return;
      }
      if (session) {
        console.log('🎲 LotoSmart: ✅ Sessão sincronizada com o background!', response);
      } else {
        console.log('🎲 LotoSmart: Logout detectado, extensão notificada.');
      }
    }
  );
}

function checkAndSync() {
  const session = extractSession();
  const hash = session ? session.access_token.substring(0, 20) : 'null';

  if (hash !== lastSessionHash) {
    lastSessionHash = hash;
    console.log('🎲 LotoSmart: Mudança detectada, sincronizando com background...');
    sendSessionToBackground(session);
  }
}

// Expõe função globalmente para o popup poder chamar via scripting
window.__lotosmart_getSession = extractSession;

// Verifica na carga inicial
checkAndSync();

// Monitora a cada 3 segundos
setInterval(checkAndSync, 3000);

// Captura login/logout na mesma aba via evento storage
window.addEventListener('storage', (e) => {
  if (e.key && (e.key === SUPABASE_STORAGE_KEY || (e.key.startsWith('sb-') && e.key.endsWith('-auth-token')))) {
    console.log('🎲 LotoSmart: Evento storage detectado, re-sincronizando...');
    lastSessionHash = null;
    checkAndSync();
  }
});
