import os
from playwright.sync_api import sync_playwright

PROFILE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "playwright_profile"))
URL = "https://www.loteriasonline.caixa.gov.br/silce-web/#/lotofacil"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=PROFILE_DIR,
        headless=False,
    )
    page = context.pages[0] if context.pages else context.new_page()

    page.goto(URL, timeout=30000)
    page.wait_for_timeout(3000)

    print("Testando Limpar Volante")
    for sel in ['a:has-text("Limpar Volante")', 'button:has-text("Limpar Volante")', 'a:has-text("Limpar")', 'button:has-text("Limpar")']:
        loc = page.locator(sel)
        count = loc.count()
        print(f"  {sel} -> {count}")

    print("Testando Colocar no Carrinho")
    for sel in ['a:has-text("Colocar no Carrinho")', 'button:has-text("Colocar no Carrinho")', 'a#colocar-no-carrinho', 'button#colocar-no-carrinho']:
        loc = page.locator(sel)
        count = loc.count()
        print(f"  {sel} -> {count}")

    context.close()
