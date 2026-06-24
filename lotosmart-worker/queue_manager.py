"""
queue_manager.py — Comunicação com o Supabase para gerenciar a fila de automação.

Responsabilidades:
  - Capturar o próximo job da fila (claim_next_job RPC)
  - Buscar os dados da aposta (bets.games)
  - Marcar job como concluído ou falho
  - Atualizar status da aposta em bets
"""
import logging
from datetime import datetime, timezone
from supabase import create_client, Client

import config

logger = logging.getLogger("lotosmart.queue")

_client: Client | None = None


def get_client() -> Client:
    """Retorna instância singleton do Supabase client (service_role)."""
    global _client
    if _client is None:
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        logger.info("Supabase client inicializado (service_role)")
    return _client


def claim_next_job() -> dict | None:
    """
    Chama a RPC claim_next_job no Supabase.
    Retorna o job dict se houver trabalho, ou None se a fila está vazia.
    """
    client = get_client()
    try:
        result = client.rpc("claim_next_job", {"p_worker_id": config.WORKER_ID}).execute()
        if result.data and len(result.data) > 0:
            job = result.data[0]
            logger.info(f"Job capturado: {job['id']} (bet_id={job['bet_id']})")
            return job
        return None
    except Exception as e:
        logger.error(f"Erro ao capturar job da fila: {e}")
        return None


def fetch_bet_data(bet_id: str) -> dict | None:
    """
    Busca os dados completos da aposta (games, lottery_type, etc).
    """
    client = get_client()
    try:
        result = (
            client.table("bets")
            .select("*")
            .eq("id", bet_id)
            .single()
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error(f"Erro ao buscar bet {bet_id}: {e}")
        return None


def complete_job(job_id: str, bet_id: str, protocol: str = "") -> bool:
    """
    Marca o job como concluído e atualiza a aposta.
    """
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()
    try:
        # 1. Atualiza automation_queue
        client.table("automation_queue").update({
            "status": "completed",
            "completed_at": now,
        }).eq("id", job_id).execute()

        # 2. Atualiza bets
        client.table("bets").update({
            "automation_status": "completed",
            "automation_completed_at": now,
            "external_protocol": protocol or None,
        }).eq("id", bet_id).execute()

        logger.info(f"Job {job_id} concluído com sucesso (protocol={protocol})")
        return True
    except Exception as e:
        logger.error(f"Erro ao marcar job {job_id} como concluído: {e}")
        return False


def fail_job(job_id: str, bet_id: str, error_msg: str, retry_count: int, max_retries: int) -> bool:
    """
    Marca o job como falho. Re-enfileira se retry_count < max_retries.
    """
    client = get_client()
    new_retry = retry_count + 1
    should_requeue = new_retry < max_retries

    try:
        # 1. Atualiza automation_queue
        new_status = "queued" if should_requeue else "failed"
        update_data = {
            "status": new_status,
            "last_error": error_msg[:500],  # Limita tamanho do erro
            "retry_count": new_retry,
        }
        if not should_requeue:
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

        client.table("automation_queue").update(update_data).eq("id", job_id).execute()

        # 2. Atualiza bets se falha definitiva
        if not should_requeue:
            client.table("bets").update({
                "automation_status": "failed",
            }).eq("id", bet_id).execute()
            logger.warning(f"Job {job_id} FALHOU definitivamente após {new_retry} tentativas: {error_msg}")
        else:
            logger.info(f"Job {job_id} falhou (tentativa {new_retry}/{max_retries}), re-enfileirado: {error_msg}")

        return True
    except Exception as e:
        logger.error(f"Erro ao registrar falha do job {job_id}: {e}")
        return False
