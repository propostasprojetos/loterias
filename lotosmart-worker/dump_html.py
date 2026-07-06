import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('https://www.loteriasonline.caixa.gov.br/silce-web/#/lotofacil', wait_until='networkidle')
    page.wait_for_timeout(3000) # Give it 3 seconds to render the SPA
    
    with open('lotofacil.html', 'w', encoding='utf-8') as f:
        f.write(page.content())
    browser.close()
