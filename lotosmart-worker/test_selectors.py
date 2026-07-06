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

    # Verifica se os seletores funcionam
    for n in ["01", "25"]:
        print(f"Testando número {n}")
        
        selectors = [
            f'a:text-is("{n}")',
            f'span:text-is("{n}")',
            f'a:has(span:text-is("{n}"))',
            f'[data-numero="{n}"]'
        ]
        
        for sel in selectors:
            loc = page.locator(sel)
            count = loc.count()
            print(f"  {sel} -> {count}")
            if count > 0:
                print(f"    isVisible? {loc.first.is_visible()}")
                try:
                    # just hover to ensure it's interactable
                    loc.first.hover(timeout=1000)
                    print(f"    Hover success!")
                except Exception as e:
                    print(f"    Hover failed: {e}")

    context.close()
