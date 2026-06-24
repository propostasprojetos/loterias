"""
config.py — Carrega e valida variáveis de ambiente do .env
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env do diretório do worker
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    print(f"[AVISO] Arquivo .env não encontrado em {_env_path}")
    print("Copie .env.example para .env e preencha com suas credenciais.")
    sys.exit(1)


def _require(var_name: str) -> str:
    """Lê variável obrigatória. Encerra se ausente."""
    val = os.getenv(var_name)
    if not val:
        print(f"[ERRO] Variável de ambiente obrigatória ausente: {var_name}")
        sys.exit(1)
    return val


# ── Supabase ──────────────────────────────────────────────
SUPABASE_URL: str = _require("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require("SUPABASE_SERVICE_KEY")

# ── Caixa Loterias ────────────────────────────────────────
CAIXA_CPF: str = _require("CAIXA_CPF")
CAIXA_PASSWORD: str = _require("CAIXA_PASSWORD")

# ── Worker ────────────────────────────────────────────────
WORKER_ID: str = os.getenv("WORKER_ID", "worker-local-1")
POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))
HEADLESS: bool = os.getenv("HEADLESS", "false").lower() == "true"
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
SCREENSHOTS_DIR: str = os.getenv("SCREENSHOTS_DIR", "./screenshots")

# ── URLs da Caixa ─────────────────────────────────────────
CAIXA_BASE_URL = "https://loteriasonline.caixa.gov.br"
CAIXA_LOGIN_URL = f"{CAIXA_BASE_URL}/silce-web/index"
CAIXA_LOTOFACIL_URL = f"{CAIXA_BASE_URL}/silce-web/lotofacil/aposta"
CAIXA_QUINA_URL = f"{CAIXA_BASE_URL}/silce-web/quina/aposta"
CAIXA_CART_URL = f"{CAIXA_BASE_URL}/silce-web/carrinho"

# Mapeamento slug → URL de aposta
GAME_URLS: dict[str, str] = {
    "lotofacil": CAIXA_LOTOFACIL_URL,
    "quina": CAIXA_QUINA_URL,
}
