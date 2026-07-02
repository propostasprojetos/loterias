"""
main.py — Loop principal do worker LotoSmart (Nova Arquitetura).

Responsabilidades:
  1. Inicializa logging
  2. Fica em poll aguardando novas apostas.
  3. Quando detecta trabalho, abre o navegador, faz login e processa tudo na mesma janela.
  4. Quando finaliza todos os jogos pendentes, avisa o usuário e finaliza o worker.
"""
import logging
import sys
import time
import tkinter as tk
from tkinter import messagebox
from pathlib import Path

import config
import queue_manager
from bot.lotofacil import LotofacilBot
from bot.quina import QuinaBot
from bot.browser_manager import BrowserManager


# ── Logging ───────────────────────────────────────────────

def setup_logging():
    """Configura logging com saída para console e arquivo."""
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

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


# ── Processamento de um job individual ────────────────────

def process_job(job: dict, browser: BrowserManager, logger: logging.Logger):
    """
    Processa um único job (usando o browser já aberto e logado).
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

    bet = queue_manager.fetch_bet_data(bet_id)
    if not bet:
        queue_manager.fail_job(job_id, bet_id, "Aposta nao encontrada no banco", retry_count, max_retries)
        return

    lottery_type = bet.get("lottery_type", "")
    bet_games = bet.get("bet_games", [])

    if not bet_games:
        logger.warning(f"Sem jogos em bet_games para bet {bet_id}.")
        queue_manager.fail_job(job_id, bet_id, "Sem jogos pendentes em bet_games", retry_count, max_retries)
        return

    logger.info(f"  lottery_type: {lottery_type}")
    logger.info(f"  total_jogos:  {len(bet_games)}")

    BotClass = BOT_REGISTRY.get(lottery_type)
    if not BotClass:
        queue_manager.fail_job(
            job_id, bet_id,
            f"Tipo de loteria nao suportado: '{lottery_type}'.",
            retry_count, max_retries
        )
        return

    try:
        # Instancia o bot injetando a página já logada
        bot = BotClass(page=browser.page)
        
        # Executa o preenchimento dos jogos e adição ao carrinho (sem checkout automático)
        protocol = bot.execute_bet(bet_games, lottery_type)

        # Sucesso
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
    logger.info("LotoSmart Worker iniciado (Modo Lote Contínuo)")
    logger.info(f"  Worker ID:      {config.WORKER_ID}")
    logger.info(f"  Poll interval:  {config.POLL_INTERVAL}s")
    logger.info(f"  Supabase URL:   {config.SUPABASE_URL[:40]}...")
    logger.info("=" * 60)

    try:
        while True:
            # 1. Verifica se há pelomenos UM job para iniciar o lote
            primeiro_job = queue_manager.claim_next_job()

            if primeiro_job:
                logger.info("Iniciando processamento em lote. Abrindo navegador...")
                
                # 2. Iniciar navegador e garantir login
                browser = BrowserManager()
                browser.start()
                
                if not browser.ensure_login():
                    logger.error("Falha no login. Abortando este lote...")
                    browser.stop()
                    queue_manager.fail_job(primeiro_job["id"], primeiro_job["bet_id"], "Falha no login", 0, 3)
                    time.sleep(config.POLL_INTERVAL)
                    continue

                # 3. Processar o primeiro job
                process_job(primeiro_job, browser, logger)

                # 4. Loop consumindo o resto da fila até esvaziar
                while True:
                    next_job = queue_manager.claim_next_job()
                    if not next_job:
                        break  # Fila esvaziou!
                    process_job(next_job, browser, logger)

                # 5. Fim do lote (Fila vazia)
                logger.info("Todas as apostas foram processadas!")
                logger.info("Navegando para o carrinho e alertando usuário...")

                if browser.page:
                    try:
                        browser.page.goto(config.CAIXA_CART_URL, timeout=30000)
                        browser.take_screenshot("06_cart_final")
                    except Exception as e:
                        logger.warning(f"Erro ao navegar pro carrinho: {e}")

                # Mostra o popup nativo avisando para pagar
                root = tk.Tk()
                root.withdraw() # Oculta a janela principal do tkinter
                root.attributes("-topmost", True) # Mantém popup sempre na frente
                
                messagebox.showinfo(
                    "LotoSmart Worker",
                    "✅ TODAS as apostas foram geradas e estão no Carrinho!\n\n"
                    "O robô fará uma pausa agora. Prossiga com o pagamento manualmente "
                    "no navegador.\n\n"
                    "Ao clicar em OK o robô será fechado."
                )

                # Fecha o worker após o popup
                logger.info("Finalizando o Worker a pedido do usuário.")
                browser.stop()
                sys.exit(0)

            else:
                logger.debug(f"Fila vazia. Aguardando {config.POLL_INTERVAL}s...")
                time.sleep(config.POLL_INTERVAL)

    except KeyboardInterrupt:
        logger.info("Worker encerrado pelo usuário (Ctrl+C)")
    except Exception as e:
        logger.error(f"Erro inesperado no loop principal: {e}", exc_info=True)


if __name__ == "__main__":
    main()
