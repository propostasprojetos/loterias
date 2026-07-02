"""
bot/base.py — Classe abstrata base para bots de loteria.

Define o contrato que todo bot específico (Lotofácil, Quina, etc.) deve seguir.
Não gerencia mais o ciclo de vida do Playwright, agora ele recebe o objeto Page pronto.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page

import config
import queue_manager

logger = logging.getLogger("lotosmart.bot")


class LotteryBot(ABC):
    """Classe base para automação de apostas em loterias."""

    def __init__(self, page: Page):
        self.page: Page = page
        self._screenshots_dir = Path(config.SCREENSHOTS_DIR)
        self._screenshots_dir.mkdir(parents=True, exist_ok=True)

    # ── Screenshot ────────────────────────────────────────

    def take_screenshot(self, label: str) -> str:
        """Captura screenshot com timestamp. Retorna o caminho do arquivo."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{ts}_{label}.png"
        filepath = self._screenshots_dir / filename
        try:
            self.page.screenshot(path=str(filepath), full_page=True)
            logger.info(f"Screenshot salva: {filepath.relative_to(Path.cwd())}")
            return str(filepath)
        except Exception as e:
            logger.warning(f"Erro ao salvar screenshot: {e}")
            return ""

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

    # ── Execução de uma aposta (sem reinício de browser) ─

    def execute_bet(self, bet_games: list[dict], lottery_type: str) -> str:
        """
        Executa o fluxo da aposta: navegar → preencher jogos → add to cart.
        Não fecha o browser no final.
        
        Args:
            bet_games: Lista de dicts com {'id': uuid, 'numbers': [int, ...], 'game_index': int}
            lottery_type: Slug do tipo de loteria (ex: 'lotofacil', 'quina').
        
        Retorna o UUID da aposta original, mas não fecha o fluxo financeiro.
        """
        # 1. Navegar até o jogo
        if not self.navigate_to_game():
            raise RuntimeError(f"Falha ao navegar para {lottery_type}")

        # 2. Preencher cada jogo e adicionar ao carrinho
        for i, bg in enumerate(bet_games):
            game_id = bg["id"]
            numbers = bg["numbers"]

            logger.info(f"Preenchendo jogo {i+1}/{len(bet_games)} (id={game_id}): {numbers}")

            # Atualiza status para "processando" em tempo real
            queue_manager.update_game_status(game_id, "processando")

            if not self.fill_single_game(numbers):
                queue_manager.update_game_status(game_id, "erro", f"Falha ao preencher jogo {i+1}: {numbers}")
                raise RuntimeError(f"Falha ao preencher jogo {i+1}: {numbers}")

            if not self.add_to_cart():
                queue_manager.update_game_status(game_id, "erro", f"Falha ao adicionar jogo {i+1} ao carrinho")
                raise RuntimeError(f"Falha ao adicionar jogo {i+1} ao carrinho")

            # Sucesso individual — move para "pendente_lancamento"
            queue_manager.update_game_status(game_id, "pendente_lancamento")
            self.take_screenshot(f"05_game_{i+1}_added")
            self.page.wait_for_timeout(1000)  # Pausa entre jogos

        # Sem checkout automático. Apenas retorna indicando sucesso.
        return "ADICIONADO_AO_CARRINHO"
