/**
 * LotoSmart Worker — Gerenciador de Fila (Background)
 * 
 * Orquestra o consumo da fila de automação via Polling e Realtime.
 * Mantém o lock atômico usando a RPC claim_next_job.
 */

import { createLogger } from '../shared/logger.js';
import * as db from './supabase.js';
import { POLL_INTERVAL_SECONDS } from '../shared/config.js';

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
    // FASE 4/5: Aqui a extensão abrirá a aba da Caixa e enviará os 
    // jogos para o Content Script executar os cliques.
    //
    // Por enquanto (Fase 3), vamos apenas simular o sucesso para 
    // testar o fluxo de banco.
    // ─────────────────────────────────────────────────────────────
    log.debug(`Enviando ${games.length} jogos para o Content Script (SIMULAÇÃO)`);

    // SIMULAÇÃO: Atualiza os jogos para sucesso
    for (const game of games) {
      await db.updateGameStatus(game.id, 'processando');
      // simulate delay
      await new Promise(r => setTimeout(r, 500));
      await db.updateGameStatus(game.id, 'pendente_lancamento');
    }

    // Conclui o job
    await db.completeJob(job.id, bet.id);

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
