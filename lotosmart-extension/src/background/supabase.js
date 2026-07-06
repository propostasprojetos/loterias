/**
 * LotoSmart Worker — Cliente Supabase (SDK Oficial)
 * 
 * Este módulo centraliza todas as interações com o Supabase usando
 * o SDK oficial (@supabase/supabase-js), substituindo a versão fetch/REST.
 */

import { createClient } from '../shared/supabase-sdk.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/config.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('SupabaseClient');

// Inicializa o cliente do Supabase
// Utilizamos um storage customizado apontando para o chrome.storage.local
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get([key]);
        return result[key] ?? null;
      },
      setItem: async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
      },
      removeItem: async (key) => {
        await chrome.storage.local.remove([key]);
      }
    }
  }
});

// Mantemos referência para as inscrições Realtime
let realtimeChannel = null;

/**
 * Retorna o cliente Supabase subjacente (uso interno).
 */
export function getClient() {
  return supabase;
}

/**
 * Verifica se o usuário atual está autenticado.
 */
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Recebe uma sessão diretamente (vinda do Dashboard Web) e aplica no cliente.
 */
export async function setSessionFromWeb(sessionObj) {
  if (!sessionObj || !sessionObj.access_token || !sessionObj.refresh_token) {
    log.error('Sessão recebida é inválida', sessionObj);
    return;
  }
  
  const { data, error } = await supabase.auth.setSession({
    access_token: sessionObj.access_token,
    refresh_token: sessionObj.refresh_token
  });

  if (error) {
    log.error('Erro ao definir sessão no Supabase SDK', error);
  } else {
    log.info('Sessão definida com sucesso via SDK', data.session.user.id);
  }
}

/**
 * Executa a RPC "claim_next_job" para puxar a próxima aposta da fila.
 * (FOR UPDATE SKIP LOCKED atômico no banco).
 */
export async function claimNextJob(workerId) {
  try {
    const { data, error } = await supabase.rpc('claim_next_job', {
      p_worker_id: workerId
    });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    log.error('Erro ao fazer claim do próximo job', err);
    throw err;
  }
}

/**
 * Busca os detalhes da aposta e os jogos pendentes.
 */
export async function fetchBetAndGames(betId) {
  try {
    const [betResult, gamesResult] = await Promise.all([
      supabase.from('bets').select('*').eq('id', betId).single(),
      supabase.from('bet_games').select('*').eq('bet_id', betId).eq('status', 'pendente').order('game_index')
    ]);

    if (betResult.error) throw betResult.error;
    if (gamesResult.error) throw gamesResult.error;

    return {
      bet: betResult.data,
      games: gamesResult.data
    };
  } catch (err) {
    log.error('Erro ao buscar dados da aposta', err);
    throw err;
  }
}

/**
 * Atualiza o status de um jogo individual (bet_games).
 */
export async function updateGameStatus(gameId, status, errorMessage = null) {
  try {
    const updateData = { status };
    if (errorMessage) {
      updateData.error_message = errorMessage.substring(0, 500);
    }
    if (status === 'sucesso' || status === 'erro') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('bet_games').update(updateData).eq('id', gameId);
    if (error) throw error;
    
    log.debug(`Jogo ${gameId} atualizado para ${status}`);
  } catch (err) {
    log.error(`Erro ao atualizar jogo ${gameId}`, err);
    throw err;
  }
}

/**
 * Finaliza o Job na fila e atualiza o status na tabela bets.
 */
export async function completeJob(jobId, betId, protocol = "ADICIONADO_AO_CARRINHO") {
  try {
    const now = new Date().toISOString();
    
    // Atualiza automation_queue
    const qRes = await supabase.from('automation_queue').update({
      status: 'completed',
      completed_at: now
    }).eq('id', jobId);
    if (qRes.error) throw qRes.error;

    // Atualiza bets
    const bRes = await supabase.from('bets').update({
      automation_status: 'completed',
      automation_completed_at: now,
      external_protocol: protocol
    }).eq('id', betId);
    if (bRes.error) throw bRes.error;

    log.info(`Job ${jobId} finalizado com sucesso!`);
  } catch (err) {
    log.error(`Erro ao completar job ${jobId}`, err);
    throw err;
  }
}

/**
 * Marca o job como falho, incrementando os retries. Se atingir o max_retries, define status final.
 */
export async function failJob(jobId, betId, errorMessage, currentRetryCount, maxRetries) {
  try {
    const newRetry = currentRetryCount + 1;
    const now = new Date().toISOString();
    
    const updateData = {
      retry_count: newRetry,
      last_error: errorMessage.substring(0, 500)
    };

    if (newRetry >= maxRetries) {
      updateData.status = 'failed';
      updateData.completed_at = now;
      
      // Também atualiza a bet principal
      await supabase.from('bets').update({ automation_status: 'failed' }).eq('id', betId);
      log.error(`Job ${jobId} falhou definitivamente após ${newRetry} tentativas`);
    } else {
      updateData.status = 'queued'; // Volta para a fila
      log.warn(`Job ${jobId} falhou. Retentativa ${newRetry}/${maxRetries} agendada`);
    }

    const { error } = await supabase.from('automation_queue').update(updateData).eq('id', jobId);
    if (error) throw error;
  } catch (err) {
    log.error(`Erro ao registrar falha no job ${jobId}`, err);
    throw err;
  }
}

/**
 * Subscreve aos eventos da automation_queue para processamento imediato (Realtime).
 */
export function subscribeToQueue(ownerId, onNewJobCallback) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase.channel(`worker_queue_${ownerId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'automation_queue',
        filter: `owner_id=eq.${ownerId}`
      },
      (payload) => {
        log.info('Novo job recebido via Realtime', payload.new.id);
        onNewJobCallback(payload.new);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        log.debug('Conectado ao Realtime: automation_queue');
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        log.warn(`Realtime status: ${status}`);
      }
    });
}
