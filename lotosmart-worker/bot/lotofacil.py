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
    """Implementação específica para Lotofácil."""

    def __init__(self, page):
        super().__init__(page)

    def navigate_to_game(self) -> bool:
        """
        Navega até o volante de aposta da Lotofácil.
        A URL /#/lotofacil já abre o volante diretamente (sem precisar clicar em Aposte).
        """
        try:
            logger.info("Navegando para Lotofácil...")
            self.page.goto(config.CAIXA_LOTOFACIL_URL, wait_until="networkidle", timeout=30000)
            self.page.wait_for_timeout(2000)
            self.take_screenshot("04_lotofacil_page")

            # Confirma que o volante abriu — espera pelo título "Preencha sua aposta"
            self.page.locator('text="Preencha sua aposta"').first.wait_for(state="visible", timeout=15000)
            
            # Confirma que os números estão clicáveis (espera pelo número "01")
            self.page.locator('a:has(span:text-is("01"))').first.wait_for(state="visible", timeout=10000)
            
            logger.info("Volante da Lotofácil carregado com sucesso")
            return True
        except Exception as e:
            logger.error(f"Falha ao navegar para Lotofácil: {e}")
            self.take_screenshot("04_lotofacil_failed")
            return False

    def _click_number(self, num: int) -> bool:
        """
        Clica no número do volante da Lotofácil.
        Os números são círculos com texto "01", "02", ..., "25".
        """
        num_str = str(num).zfill(2)

        # Estratégia 1: texto exato em span dentro do link (padrão da Caixa)
        for text_selector in [
            f'a:has(span:text-is("{num_str}"))',
            f'span:text-is("{num_str}")',
        ]:
            try:
                el = self.page.locator(text_selector).first
                if el.count() > 0 and el.is_visible():
                    el.click()
                    return True
            except Exception:
                pass

        # Estratégia 2: atributo data-numero
        for attr_selector in [
            f'[data-numero="{num}"]',
            f'[data-numero="{num_str}"]',
            f'[data-value="{num}"]',
            f'[data-value="{num_str}"]',
        ]:
            el = self.page.locator(attr_selector)
            try:
                if el.count() > 0 and el.first.is_visible():
                    el.first.click()
                    return True
            except Exception:
                pass

        # Estratégia 3: JavaScript click — percorre todos os links procurando o texto exato
        try:
            result = self.page.evaluate(f"""
                () => {{
                    const els = document.querySelectorAll('a, button, li');
                    for (const el of els) {{
                        const txt = el.textContent.trim();
                        if (txt === '{num_str}' || txt === '{num}') {{
                            el.click();
                            return true;
                        }}
                    }}
                    return false;
                }}
            """)
            if result:
                logger.info(f"Número {num_str} clicado via JavaScript")
                return True
        except Exception:
            pass

        return False

    def fill_single_game(self, numbers: list[int]) -> bool:
        """
        Preenche um jogo da Lotofácil clicando nos 15 números.
        """
        try:
            # Limpa seleção anterior
            clear_btn = self.page.locator('a:has-text("Limpar Volante"), button:has-text("Limpar Volante"), a:has-text("Limpar"), button:has-text("Limpar")')
            if clear_btn.count() > 0 and clear_btn.first.is_visible():
                clear_btn.first.click()
                self.page.wait_for_timeout(500)

            # Clica em cada número
            for num in sorted(numbers):
                if not self._click_number(num):
                    logger.error(f"Não conseguiu clicar no número {num}")
                    self.take_screenshot(f"05_number_{num}_failed")
                    return False
                self.page.wait_for_timeout(200)  # Pausa entre cliques

            self.take_screenshot("05_game_filled")
            logger.info(f"Lotofácil: {len(numbers)} números preenchidos com sucesso")
            return True

        except Exception as e:
            logger.error(f"Erro ao preencher jogo Lotofácil: {e}")
            self.take_screenshot("05_fill_error")
            return False

    def add_to_cart(self) -> bool:
        """Adiciona o jogo atual ao carrinho."""
        try:
            add_btn = self.page.locator(
                'a:has-text("Colocar no Carrinho"), button:has-text("Colocar no Carrinho")'
            ).first
            add_btn.wait_for(state="visible", timeout=5000)
            add_btn.click()
            self.page.wait_for_timeout(2000)
            self.take_screenshot("06_added_to_cart")
            logger.info("Jogo adicionado ao carrinho")
            return True
        except Exception as e:
            logger.error(f"Erro ao adicionar ao carrinho: {e}")
            self.take_screenshot("05_cart_error")
            return False
