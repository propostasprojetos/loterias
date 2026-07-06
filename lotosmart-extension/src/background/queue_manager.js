/**
 * LotoSmart Worker — Gerenciador de Fila (Background)
 * 
 * Orquestra o consumo da fila de automação via Polling e Realtime.
 * Mantém o lock atômico usando a RPC claim_next_job.
 */

import { createLogger } from '../shared/logger.js';
import * as db from './supabase.js';
import { POLL_INTERVAL_SECONDS, GAME_URLS } from '../shared/config.js';

const log = createLogger('QueueManager');

let isWorkerActive = false;
let isProcessing = false;
let pollingInterval = null;
let currentWorkerId = 'worker_ext_' + Math.random().toString(36).substring(2, 9); // ID único para este worker

export function isActive() {
  return isWorkerActive;
}

/**
 * Inicia o processamento da fila.
 */
export async function startWorker() {
  if (isWorkerActive) return;
  
  const { data: { session } } = await db.getClient().auth.getSession();
  if (!session) {
    log.warn('Tentativa de iniciar worker sem autenticação');
    return;
  }

  isWorkerActive = true;
  log.info(`Worker ativado. ID: ${currentWorkerId}`);

  // Iniciar Polling
  pollingInterval = setInterval(processNextJob, POLL_INTERVAL_SECONDS * 1000);

  // Iniciar Realtime
  db.subscribeToQueue(session.user.id, (newJob) => {
    log.info(`Job ${newJob.id} na fila. Tentando processar...`);
    processNextJob();
  });

  // Tentar pegar imediatamente
  processNextJob();
}

/**
 * Para o processamento da fila.
 */
export function stopWorker() {
  isWorkerActive = false;
  if (pollingInterval) clearInterval(pollingInterval);
  log.info('Worker pausado.');
}

/**
 * Tenta fazer o claim e processar o próximo job na fila.
 */
async function processNextJob() {
  if (!isWorkerActive || isProcessing) return;
  isProcessing = true;

  try {
    const job = await db.claimNextJob(currentWorkerId);
    
    if (!job) {
      log.debug('Nenhum job na fila.');
      return;
    }

    log.info(`Job ${job.id} assumido! Iniciando automação para aposta ${job.bet_id}...`);

    // Busca dados detalhados
    const { bet, games } = await db.fetchBetAndGames(job.bet_id);

    if (!games || games.length === 0) {
      log.warn(`Aposta ${bet.id} não tem jogos pendentes.`);
      await db.failJob(job.id, bet.id, 'Sem jogos pendentes', job.retry_count, job.max_retries);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // FASE 4: Integração real com o Content Script
    // ─────────────────────────────────────────────────────────────
    log.debug(`Buscando aba da Caixa para enviar ${games.length} jogos...`);
    
    // Busca abas da Caixa
    const tabs = await chrome.tabs.query({ url: "*://*.loteriasonline.caixa.gov.br/*" });
    if (tabs.length === 0) {
      throw new Error("Nenhuma aba da Caixa Econômica encontrada. Por favor, abra o site da Caixa e faça login.");
    }
    
    let targetTab = tabs[0];
    
    // Envia o job para a aba
    const sendJobToTab = (tabId) => {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_JOB', bet, games }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            resolve(response || { status: 'error', message: 'Sem resposta' });
          }
        });
      });
    };

    let response = await sendJobToTab(targetTab.id);

    // Se estiver na página errada, redireciona e tenta de novo
    if (response.status === 'error' && response.message === 'wrong_page') {
      log.info('Redirecionando aba para a página correta do jogo...');
      const targetUrl = GAME_URLS[bet.lottery_type];
      
      await chrome.tabs.update(targetTab.id, { url: targetUrl });
      
      // Aguarda 5 segundos para a página carregar
      await new Promise(r => setTimeout(r, 5000));
      
      // Tenta enviar de novo
      response = await sendJobToTab(targetTab.id);
    }

    if (response.status === 'success') {
      // Atualiza os jogos baseados nos resultados do Content Script
      const { success, failed } = response.results;
      
      for (const gameId of success) {
        await db.updateGameStatus(gameId, 'sucesso');
      }
      
      for (const fail of failed) {
        await db.updateGameStatus(fail.id, 'erro', fail.error);
      }
      
      // Conclui o job
      await db.completeJob(job.id, bet.id);
      log.info(`Job ${job.id} processado. Sucesso: ${success.length}, Falhas: ${failed.length}`);
      
    } else {
      throw new Error(`Erro do Content Script: ${response.message}`);
    }

  } catch (error) {
    log.error('Erro no ciclo de processamento', error);
  } finally {
    isProcessing = false;

    // Se o worker continua ativo, tentar pegar outro job imediatamente
    if (isWorkerActive) {
      // Pequeno delay para não travar o event loop
      setTimeout(processNextJob, 1000);
    }
  }
}
