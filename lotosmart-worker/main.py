"""
main.py — Loop principal do worker LotoSmart.

Responsabilidades:
  1. Inicializa logging
  2. Entra em loop de polling
  3. A cada iteração: captura job → busca aposta → executa bot → atualiza status
  4. Trata erros com retry automático
"""
import logging
import sys
import time
from pathlib import Path

import config
import queue_manager
from bot.lotofacil import LotofacilBot
from bot.quina import QuinaBot


# ── Logging ───────────────────────────────────────────────

def setup_logging():
    """Configura logging com saída para console e arquivo."""
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    # Arquivo
    file_handler = logging.FileHandler(
        logs_dir / "worker.log", encoding="utf-8"
    )
    file_handler.setFormatter(formatter)

    root_logger = logging.getLogger("lotosmart")
    root_logger.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    return logging.getLogger("lotosmart.main")


# ── Registry de bots por tipo de jogo ─────────────────────

BOT_REGISTRY: dict[str, type] = {
    "lotofacil": LotofacilBot,
    "quina": QuinaBot,
}


# ── Processamento de um job ───────────────────────────────

def process_job(job: dict, logger: logging.Logger):
    """
    Processa um único job da fila:
      1. Busca os dados da aposta
      2. Instancia o bot correto
      3. Executa a aposta
      4. Atualiza status
    """
    job_id = job["id"]
    bet_id = job["bet_id"]
    retry_count = job.get("retry_count", 0)
    max_retries = job.get("max_retries", 3)

    logger.info(f"{'='*60}")
    logger.info(f"Processando job {job_id}")
    logger.info(f"  bet_id:      {bet_id}")
    logger.info(f"  tentativa:   {retry_count + 1}/{max_retries}")
    logger.info(f"{'='*60}")

    # 1. Buscar dados da aposta
    bet = queue_manager.fetch_bet_data(bet_id)
    if not bet:
        queue_manager.fail_job(job_id, bet_id, "Aposta nao encontrada no banco", retry_count, max_retries)
        return

    lottery_type = bet.get("lottery_type", "")
    bet_games = bet.get("bet_games", [])  # Lista de dicts com id, numbers, game_index

    # Validacao: precisa ter jogos pendentes na tabela bet_games
    if not bet_games:
        # Fallback legado: se ainda houver games no JSON antigo, cria registros na nova tabela
        legacy_games = bet.get("games", [])
        if legacy_games and isinstance(legacy_games, list):
            logger.warning(f"bet {bet_id} sem bet_games filhos — usando games JSON legado")
            bet_games = [
                {"id": None, "numbers": g, "game_index": i}
                for i, g in enumerate(legacy_games)
                if isinstance(g, list)
            ]
        else:
            queue_manager.fail_job(job_id, bet_id, "Sem jogos pendentes em bet_games", retry_count, max_retries)
            return

    logger.info(f"  lottery_type: {lottery_type}")
    logger.info(f"  total_jogos:  {len(bet_games)}")

    # 2. Selecionar o bot correto
    BotClass = BOT_REGISTRY.get(lottery_type)
    if not BotClass:
        queue_manager.fail_job(
            job_id, bet_id,
            f"Tipo de loteria nao suportado: '{lottery_type}'. Suportados: {list(BOT_REGISTRY.keys())}",
            retry_count, max_retries
        )
        return

    # 3. Executar a aposta
    try:
        bot = BotClass()
        protocol = bot.execute_bet(bet_games, lottery_type)

        # 4. Sucesso
        queue_manager.complete_job(job_id, bet_id, protocol)
        logger.info(f"Job {job_id} concluido com sucesso!")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Job {job_id} falhou: {error_msg}")
        queue_manager.fail_job(job_id, bet_id, error_msg, retry_count, max_retries)


# ── Loop principal ────────────────────────────────────────

def main():
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info("LotoSmart Worker iniciado")
    logger.info(f"  Worker ID:      {config.WORKER_ID}")
    logger.info(f"  Poll interval:  {config.POLL_INTERVAL}s")
    logger.info(f"  Headless:       {config.HEADLESS}")
    logger.info(f"  Supabase URL:   {config.SUPABASE_URL[:40]}...")
    logger.info("=" * 60)

    while True:
        try:
            # Tenta capturar o próximo job
            job = queue_manager.claim_next_job()

            if job:
                process_job(job, logger)
            else:
                logger.debug(f"Fila vazia. Aguardando {config.POLL_INTERVAL}s...")

        except KeyboardInterrupt:
            logger.info("Worker encerrado pelo usuário (Ctrl+C)")
            break
        except Exception as e:
            logger.error(f"Erro inesperado no loop principal: {e}", exc_info=True)

        # Aguarda antes de próximo polling
        time.sleep(config.POLL_INTERVAL)

    logger.info("Worker finalizado.")


if __name__ == "__main__":
    main()
