"""
bot/base.py — Classe abstrata base para bots de loteria.

Define o contrato que todo bot específico (Lotofácil, Quina, etc.) deve seguir.
Gerencia o ciclo de vida do Playwright (browser, contexto, página).
"""
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

import config
from bot import selectors

logger = logging.getLogger("lotosmart.bot")


class LotteryBot(ABC):
    """Classe base para automação de apostas em loterias."""

    def __init__(self):
        self.playwright = None
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._screenshots_dir = Path(config.SCREENSHOTS_DIR)
        self._screenshots_dir.mkdir(parents=True, exist_ok=True)

    # ── Ciclo de vida do browser ──────────────────────────

    def start_browser(self):
        """Inicia Playwright e abre o browser."""
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=config.HEADLESS,
            slow_mo=300,  # 300ms entre ações — mais seguro contra detecção
        )
        self.context = self.browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        self.page = self.context.new_page()
        logger.info(f"Browser iniciado (headless={config.HEADLESS})")

    def stop_browser(self):
        """Fecha tudo de forma segura."""
        try:
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
        except Exception as e:
            logger.warning(f"Erro ao fechar browser: {e}")
        finally:
            self.page = None
            self.context = None
            self.browser = None
            self.playwright = None
            logger.info("Browser encerrado")

    # ── Screenshot ────────────────────────────────────────

    def take_screenshot(self, label: str) -> str:
        """Captura screenshot com timestamp. Retorna o caminho do arquivo."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{ts}_{label}.png"
        filepath = self._screenshots_dir / filename
        if self.page:
            self.page.screenshot(path=str(filepath), full_page=True)
            logger.info(f"Screenshot salva: {filepath}")
        return str(filepath)

    # ── Login Manual Interativo ───────────────────────────

    def wait_for_user_login(self, timeout_seconds: int = 300) -> bool:
        """
        Navega para a página de login e aguarda o usuário se autenticar manualmente.
        O bot monitora a página até detectar o logged_indicator.
        """
        logger.info("Navegando para o portal de Loterias da Caixa...")
        self.page.goto(config.CAIXA_LOGIN_URL, wait_until="networkidle", timeout=30000)
        self.take_screenshot("01_login_page")

        logger.info(
            "============================================================\n"
            "   👉 ATENÇÃO: POR FAVOR REALIZE O LOGIN MANUALMENTE NO NAVEGADOR.\n"
            f"   Aguardando login por até {timeout_seconds} segundos...\n"
            "============================================================"
        )

        start_time = datetime.now()
        indicator = self.page.locator(selectors.LOGIN["logged_indicator"])

        while (datetime.now() - start_time).total_seconds() < timeout_seconds:
            try:
                # Se o indicador de logado estiver visível na página
                if indicator.count() > 0 and any(el.is_visible() for el in indicator.all()):
                    logger.info("Sessão ativa / Login detectado com sucesso!")
                    self.take_screenshot("03_logged_in")
                    return True
            except Exception:
                pass

            # Também verifica se já foi redirecionado para alguma página interna
            current_url = self.page.url
            if "login" not in current_url.lower() and "silce-web" in current_url.lower() and not current_url.endswith("/index"):
                # Se mudou de página e está em um contexto interno da caixa
                logger.info(f"Redirecionamento detectado para {current_url}. Considerando usuário logado.")
                self.take_screenshot("03_logged_in_redirect")
                return True

            self.page.wait_for_timeout(2000)  # Checa a cada 2 segundos

        logger.error("Timeout aguardando login manual do usuário.")
        self.take_screenshot("03_login_failed_timeout")
        return False

    # ── Métodos abstratos (cada jogo implementa) ──────────

    @abstractmethod
    def navigate_to_game(self) -> bool:
        """Navega até a página de aposta do jogo específico."""
        ...

    @abstractmethod
    def fill_single_game(self, numbers: list[int]) -> bool:
        """Preenche um único jogo com as dezenas fornecidas."""
        ...

    @abstractmethod
    def add_to_cart(self) -> bool:
        """Adiciona o jogo preenchido ao carrinho."""
        ...

    # ── Checkout (comum a todos os jogos) ─────────────────

    def checkout(self) -> str:
        """
        Navega ao carrinho e finaliza o pagamento via PIX.
        Retorna o protocolo/comprovante, ou string vazia se falhar.
        """
        logger.info("Iniciando checkout...")

        # Navega para o carrinho
        cart_link = self.page.locator(selectors.NAV["cart_link"])
        if cart_link.count() > 0:
            cart_link.first.click()
        else:
            self.page.goto(config.CAIXA_CART_URL, wait_until="networkidle")

        self.page.wait_for_timeout(2000)
        self.take_screenshot("06_cart")

        # Clica em finalizar/ir para pagamento
        checkout_btn = self.page.locator(selectors.CART["checkout_button"]).first
        checkout_btn.wait_for(state="visible", timeout=10000)
        checkout_btn.click()
        self.page.wait_for_timeout(3000)
        self.take_screenshot("07_payment_options")

        # Seleciona PIX
        pix_option = self.page.locator(selectors.PAYMENT["pix_option"]).first
        pix_option.wait_for(state="visible", timeout=10000)
        pix_option.click()
        self.page.wait_for_timeout(1000)

        # Confirma pagamento
        confirm_btn = self.page.locator(selectors.PAYMENT["confirm_payment"]).first
        confirm_btn.click()
        self.page.wait_for_timeout(5000)
        self.take_screenshot("08_pix_generated")

        # Tenta capturar protocolo
        protocol = ""
        try:
            protocol_el = self.page.locator(selectors.PAYMENT["protocol_number"]).first
            protocol_el.wait_for(state="visible", timeout=10000)
            protocol = protocol_el.inner_text().strip()
            logger.info(f"Protocolo capturado: {protocol}")
        except Exception:
            logger.warning("Protocolo não encontrado automaticamente")

        self.take_screenshot("09_payment_confirmation")
        return protocol

    # ── Execução completa de uma aposta ───────────────────

    def execute_bet(self, games: list[list[int]], lottery_type: str) -> str:
        """
        Executa o fluxo completo: login → navegar → preencher jogos → checkout.
        Retorna o protocolo ou levanta exceção.
        """
        try:
            self.start_browser()

            # 1. Login Manual
            if not self.wait_for_user_login():
                raise RuntimeError("Falha ou timeout no login manual na plataforma da Caixa")

            # 2. Navegar até o jogo
            if not self.navigate_to_game():
                raise RuntimeError(f"Falha ao navegar para {lottery_type}")

            # 3. Preencher cada jogo e adicionar ao carrinho
            for i, numbers in enumerate(games):
                logger.info(f"Preenchendo jogo {i+1}/{len(games)}: {numbers}")

                if not self.fill_single_game(numbers):
                    raise RuntimeError(f"Falha ao preencher jogo {i+1}: {numbers}")

                if not self.add_to_cart():
                    raise RuntimeError(f"Falha ao adicionar jogo {i+1} ao carrinho")

                self.take_screenshot(f"05_game_{i+1}_added")
                self.page.wait_for_timeout(1000)  # Pausa entre jogos

            # 4. Checkout
            protocol = self.checkout()
            return protocol

        finally:
            self.stop_browser()
