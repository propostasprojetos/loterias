"""
bot/quina.py — Implementação do bot para Quina.

Quina: 80 números (1-80), jogador escolhe 5.
"""
import logging

import config
from bot.base import LotteryBot
from bot import selectors

logger = logging.getLogger("lotosmart.bot.quina")


class QuinaBot(LotteryBot):
    """Bot específico para apostas na Quina."""

    def navigate_to_game(self) -> bool:
        """
        Navega até o volante de aposta da Quina.
        A URL /#/quina já abre o volante diretamente.
        """
        try:
            logger.info("Navegando para Quina...")
            self.page.goto(config.CAIXA_QUINA_URL, wait_until="networkidle", timeout=30000)
            self.page.wait_for_timeout(2000)
            self.take_screenshot("04_quina_page")

            # Confirma que o volante abriu
            self.page.locator('text="Preencha sua aposta"').first.wait_for(state="visible", timeout=15000)

            # Confirma que os números estão visíveis
            self.page.locator('a:has(span:text-is("01"))').first.wait_for(state="visible", timeout=10000)

            logger.info("Volante da Quina carregado com sucesso")
            return True
        except Exception as e:
            logger.error(f"Falha ao navegar para Quina: {e}")
            self.take_screenshot("04_quina_failed")
            return False

    def _click_number(self, num: int) -> bool:
        """
        Clica no número do volante da Quina.
        Os números são círculos com texto "01", "02", ..., "80".
        """
        num_str = str(num).zfill(2)

        # Estratégia 1: texto exato em span dentro do link
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

        # Estratégia 3: JavaScript click
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
        Preenche um jogo da Quina clicando nos 5 números.
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
                self.page.wait_for_timeout(200)

            self.take_screenshot("05_game_filled")
            logger.info(f"Quina: {len(numbers)} números preenchidos com sucesso")
            return True

        except Exception as e:
            logger.error(f"Erro ao preencher jogo Quina: {e}")
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
