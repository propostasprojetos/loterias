"""
bot/lotofacil.py — Implementação do bot para Lotofácil.

Lotofácil: 25 números (1-25), jogador escolhe 15.
"""
import logging

import config
from bot.base import LotteryBot
from bot import selectors

logger = logging.getLogger("lotosmart.bot.lotofacil")


class LotofacilBot(LotteryBot):
    """Bot específico para apostas na Lotofácil."""

    def navigate_to_game(self) -> bool:
        """Navega até a página de aposta da Lotofácil."""
        try:
            logger.info("Navegando para Lotofácil...")
            self.page.goto(config.CAIXA_LOTOFACIL_URL, wait_until="networkidle", timeout=30000)
            self.page.wait_for_timeout(2000)
            self.take_screenshot("04_lotofacil_page")

            # Verifica se a página carregou o grid de números
            numbers_container = self.page.locator(selectors.GAME["numbers_container"])
            numbers_container.first.wait_for(state="visible", timeout=10000)
            logger.info("Página da Lotofácil carregada com sucesso")
            return True
        except Exception as e:
            logger.error(f"Falha ao navegar para Lotofácil: {e}")
            self.take_screenshot("04_lotofacil_failed")
            return False

    def fill_single_game(self, numbers: list[int]) -> bool:
        """
        Preenche um jogo da Lotofácil clicando nos 15 números.
        """
        try:
            # Limpa seleção anterior (se houver)
            clear_btn = self.page.locator(selectors.GAME["clear_selection"])
            if clear_btn.count() > 0 and clear_btn.first.is_visible():
                clear_btn.first.click()
                self.page.wait_for_timeout(500)

            # Clica em cada número
            for num in sorted(numbers):
                # Tenta múltiplos seletores para encontrar o botão do número
                # Formato 1: atributo data com o número
                # Formato 2: texto do botão
                num_str = str(num).zfill(2)  # "01", "02", ..., "25"

                clicked = False
                # Tenta por data-attribute
                for selector_pattern in [
                    f'[data-numero="{num}"]',
                    f'[data-numero="{num_str}"]',
                    f'[data-value="{num}"]',
                    f'[data-value="{num_str}"]',
                ]:
                    el = self.page.locator(selector_pattern)
                    if el.count() > 0 and el.first.is_visible():
                        el.first.click()
                        clicked = True
                        break

                # Fallback: procura por texto exato dentro do container de números
                if not clicked:
                    container = self.page.locator(selectors.GAME["numbers_container"]).first
                    num_btn = container.locator(f'text="{num_str}"')
                    if num_btn.count() > 0:
                        num_btn.first.click()
                        clicked = True

                if not clicked:
                    logger.error(f"Não conseguiu clicar no número {num}")
                    return False

                self.page.wait_for_timeout(150)  # Pausa curta entre cliques

            logger.info(f"Lotofácil: {len(numbers)} números preenchidos com sucesso")
            return True

        except Exception as e:
            logger.error(f"Erro ao preencher jogo Lotofácil: {e}")
            self.take_screenshot("05_fill_error")
            return False

    def add_to_cart(self) -> bool:
        """Adiciona o jogo atual ao carrinho."""
        try:
            add_btn = self.page.locator(selectors.GAME["add_to_cart"]).first
            add_btn.wait_for(state="visible", timeout=5000)
            add_btn.click()
            self.page.wait_for_timeout(2000)

            # Verifica se apareceu confirmação ou se o carrinho atualizou
            logger.info("Jogo adicionado ao carrinho")
            return True
        except Exception as e:
            logger.error(f"Erro ao adicionar ao carrinho: {e}")
            self.take_screenshot("05_cart_error")
            return False
