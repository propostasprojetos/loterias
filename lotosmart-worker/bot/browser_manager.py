import logging
import os
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, BrowserContext, Page

import config
from bot import selectors

logger = logging.getLogger("lotosmart.browser")


class BrowserManager:
    """
    Gerencia a sessão única do Playwright para que múltiplos jogos 
    possam ser processados sequencialmente na mesma janela.
    """
    def __init__(self):
        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._screenshots_dir = Path(config.SCREENSHOTS_DIR)
        self._screenshots_dir.mkdir(parents=True, exist_ok=True)

    def start(self):
        """Inicia Playwright e abre o browser."""
        if self.playwright:
            return

        self.playwright = sync_playwright().start()
        user_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "playwright_profile"))
        
        self.context = self.playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=config.HEADLESS,
            slow_mo=300,
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        self.page = self.context.pages[0] if self.context.pages else self.context.new_page()
        logger.info(f"Browser iniciado (headless={config.HEADLESS})")

    def stop(self):
        """Fecha o contexto do browser (se headless). Se headless=False, deixa a janela viva para checkout."""
        # Se headless=False, nós não vamos fechar o browser via código
        # para que o usuário possa finalizar o pagamento. O fechamento do script fará o cleanup nativo se necessário.
        if config.HEADLESS:
            try:
                if self.context:
                    self.context.close()
                if self.playwright:
                    self.playwright.stop()
            except Exception as e:
                logger.warning(f"Erro ao fechar browser: {e}")
        else:
            logger.info("Browser mantido aberto para checkout manual.")

    def take_screenshot(self, label: str) -> str:
        if not self.page:
            return ""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = self._screenshots_dir / f"{ts}_{label}.png"
        try:
            self.page.screenshot(path=str(filepath))
            logger.info(f"Screenshot salva: {filepath.relative_to(Path.cwd())}")
            return str(filepath)
        except Exception as e:
            logger.warning(f"Erro ao salvar screenshot '{label}': {e}")
            return ""

    def ensure_login(self, timeout_seconds: int = 300) -> bool:
        """
        Navega para a página inicial e verifica/aguarda login.
        Só deve ser chamado no início da execução em lote.
        """
        if not self.page:
            return False

        logger.info("Navegando para o portal de Loterias da Caixa...")
        self.page.goto(config.CAIXA_LOGIN_URL, wait_until="networkidle", timeout=30000)
        self.take_screenshot("01_login_page")

        logger.info(
            "============================================================\n"
            "   ATENCAO: POR FAVOR REALIZE O LOGIN MANUALMENTE NO NAVEGADOR.\n"
            f"   Aguardando login por ate {timeout_seconds} segundos...\n"
            "============================================================"
        )

        start_time = datetime.now()
        indicator = self.page.locator(selectors.LOGIN["logged_indicator"])

        while (datetime.now() - start_time).total_seconds() < timeout_seconds:
            try:
                # Tenta fechar cookies e popup +18 (Pode ser <a>, <button> ou <span>)
                btn_aceitar = self.page.locator('text="Aceitar"').first
                if btn_aceitar.count() > 0 and btn_aceitar.is_visible():
                    btn_aceitar.click(force=True)
                
                btn_sim = self.page.locator('text="Sim"').first
                if btn_sim.count() > 0 and btn_sim.is_visible():
                    btn_sim.click(force=True)
                
                # Se o indicador de logado estiver visível na página
                if indicator.count() > 0 and any(el.is_visible() for el in indicator.all()):
                    logger.info("Sessao ativa / Login detectado com sucesso!")
                    self.take_screenshot("03_logged_in")
                    return True
                
                # Fallback: Se já se passaram 10 segundos e o botão "Acessar" NÃO está na tela
                btn_acessar = self.page.locator('text="Acessar"').first
                elapsed = (datetime.now() - start_time).total_seconds()
                if elapsed > 10 and not btn_acessar.is_visible():
                    logger.info("Botão 'Acessar' sumiu. Assumindo que o login já está ativo!")
                    self.take_screenshot("03_assumed_logged_in")
                    return True

            except Exception:
                pass

            self.page.wait_for_timeout(2000)

        logger.error("Timeout aguardando login manual do usuario.")
        self.take_screenshot("03_login_failed_timeout")
        return False
