import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    profile_dir = os.path.abspath('playwright_profile')
    context = p.chromium.launch_persistent_context(profile_dir, headless=True)
    page = context.pages[0] if context.pages else context.new_page()
    page.goto('https://www.loteriasonline.caixa.gov.br/silce-web/#/home', wait_until='networkidle')
    page.wait_for_timeout(3000)
    
    if page.locator('text="Sim"').count() > 0 and page.locator('text="Sim"').first.is_visible():
        page.locator('text="Sim"').first.click(force=True)
        page.wait_for_timeout(2000)
    
    with open('logged_in.html', 'w', encoding='utf-8') as f:
        f.write(page.content())
    context.close()
