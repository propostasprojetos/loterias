/**
 * LotoSmart Worker — Configuração Global
 * 
 * Centraliza todas as constantes, URLs e parâmetros de configuração
 * da extensão. Nenhum outro módulo deve conter valores hardcoded.
 */

// ═══════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════
export const SUPABASE_URL = 'https://klrivylidketfbaakbil.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtscml2eWxpZGtldGZiYWFrYmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDg3MTEsImV4cCI6MjA5NTM4NDcxMX0.hM-wBFJV8mUlUj1G0QhDtBrJ4Xcb0L4HBel0dR0bi7s';

// ═══════════════════════════════════════════════════
// CAIXA ECONÔMICA — URLs do Site de Loterias
// ═══════════════════════════════════════════════════
export const CAIXA_BASE_URL = 'https://www.loteriasonline.caixa.gov.br';
export const CAIXA_LOGIN_URL = `${CAIXA_BASE_URL}/silce-web/#/home`;
export const CAIXA_CART_URL = `${CAIXA_BASE_URL}/silce-web/#/carrinho`;

export const GAME_URLS = {
  megasena:       `${CAIXA_BASE_URL}/silce-web/#/mega-sena`,
  lotofacil:      `${CAIXA_BASE_URL}/silce-web/#/lotofacil`,
  quina:          `${CAIXA_BASE_URL}/silce-web/#/quina`,
  maismilionaria: `${CAIXA_BASE_URL}/silce-web/#/mais-milionaria`,
  diadesorte:     `${CAIXA_BASE_URL}/silce-web/#/dia-de-sorte`,
  duplasena:      `${CAIXA_BASE_URL}/silce-web/#/dupla-sena`,
  supersete:      `${CAIXA_BASE_URL}/silce-web/#/super-sete`,
  timemania:      `${CAIXA_BASE_URL}/silce-web/#/timemania`,
  lotomania:      `${CAIXA_BASE_URL}/silce-web/#/lotomania`
};

// ═══════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════
export const WORKER_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════
// TIMEOUTS (em milissegundos)
// ═══════════════════════════════════════════════════
export const TIMEOUT_CLICK_NUMBER   = 5000;   // Espera por número clicável
export const TIMEOUT_ADD_CART       = 10000;  // Espera por "Colocar no Carrinho"
export const TIMEOUT_PAGE_LOAD     = 30000;  // Espera por carregamento da página
export const TIMEOUT_BETWEEN_CLICKS = 250;   // Pausa entre cliques de números
export const TIMEOUT_BETWEEN_GAMES  = 1500;  // Pausa entre jogos diferentes
export const TIMEOUT_AFTER_CART     = 2500;   // Pausa após adicionar ao carrinho

// ═══════════════════════════════════════════════════
// POLLING / HEARTBEAT
// ═══════════════════════════════════════════════════
export const POLL_INTERVAL_SECONDS  = 30;     // Intervalo de polling da fila
export const HEARTBEAT_INTERVAL_MIN = 1;      // Intervalo do heartbeat em minutos

// ═══════════════════════════════════════════════════
// RETRY
// ═══════════════════════════════════════════════════
export const MAX_RETRIES = 3;
