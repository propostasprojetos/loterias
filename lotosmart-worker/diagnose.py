"""
Script de diagnóstico — descobre os seletores reais do site da Caixa.
Navega até a Lotofácil e faz um dump completo do HTML do volante.
"""
import os
from playwright.sync_api import sync_playwright

PROFILE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "playwright_profile"))
URL = "https://www.loteriasonline.caixa.gov.br/silce-web/#/lotofacil"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=PROFILE_DIR,
        headless=False,
        slow_mo=300,
        viewport={"width": 1280, "height": 800},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    )
    page = context.pages[0] if context.pages else context.new_page()

    print("1. Navegando para a home para garantir login...")
    page.goto("https://www.loteriasonline.caixa.gov.br/silce-web/#/home", timeout=30000)
    page.wait_for_timeout(3000)
    print(f"   URL atual: {page.url}")

    print("2. Navegando para Lotofácil...")
    page.goto(URL, timeout=30000)
    page.wait_for_timeout(5000)  # Espera EXTRA para o Angular renderizar
    print(f"   URL atual: {page.url}")

    # Tira screenshot
    page.screenshot(path="screenshots/diag_lotofacil.png", full_page=True)
    print("3. Screenshot salva em screenshots/diag_lotofacil.png")

    # Verifica se há iframes
    frames = page.frames
    print(f"\n4. Total de frames na página: {len(frames)}")
    for i, frame in enumerate(frames):
        print(f"   Frame {i}: name='{frame.name}', url='{frame.url}'")

    # Dump do HTML completo da página
    html = page.content()
    with open("diag_full_page.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\n5. HTML completo salvo em diag_full_page.html ({len(html)} chars)")

    # Busca elementos que contenham "01" ou "Preencha"
    print("\n6. Buscando elementos com texto 'Preencha sua aposta'...")
    preencha = page.locator('text="Preencha sua aposta"')
    print(f"   Encontrados: {preencha.count()}")

    print("\n7. Buscando elementos com texto exato '01'...")
    for tag in ['a', 'button', 'span', 'div', 'li', 'p', 'label', 'td']:
        locator = page.locator(f'{tag}:text-is("01")')
        count = locator.count()
        if count > 0:
            print(f"   ✅ {tag}:text-is('01') → {count} encontrado(s)")
            try:
                outer = locator.first.evaluate("el => el.outerHTML")
                print(f"      HTML: {outer[:200]}")
            except:
                pass
        else:
            print(f"   ❌ {tag}:text-is('01') → 0")

    # Tenta por seletor genérico
    print("\n8. Buscando por seletores genéricos...")
    generic = page.locator(':text-is("01")')
    print(f"   :text-is('01') → {generic.count()} encontrado(s)")
    if generic.count() > 0:
        for i in range(min(generic.count(), 5)):
            try:
                tag_name = generic.nth(i).evaluate("el => el.tagName")
                classes = generic.nth(i).evaluate("el => el.className")
                outer = generic.nth(i).evaluate("el => el.outerHTML")
                print(f"   [{i}] <{tag_name}> class='{classes}' → {outer[:200]}")
            except:
                pass

    # Busca via JavaScript no DOM
    print("\n9. Busca via JavaScript — todos os elementos com textContent '01'...")
    js_result = page.evaluate("""
        () => {
            const results = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim() === '01' && node.children.length === 0) {
                    results.push({
                        tag: node.tagName,
                        id: node.id,
                        className: node.className,
                        outerHTML: node.outerHTML.substring(0, 300),
                        parentTag: node.parentElement ? node.parentElement.tagName : 'none',
                        parentClass: node.parentElement ? node.parentElement.className : 'none',
                        grandParentTag: node.parentElement && node.parentElement.parentElement ? node.parentElement.parentElement.tagName : 'none',
                        grandParentClass: node.parentElement && node.parentElement.parentElement ? node.parentElement.parentElement.className : 'none',
                    });
                }
            }
            return results;
        }
    """)
    print(f"   Encontrados {len(js_result)} elementos leaf com texto '01':")
    for r in js_result:
        print(f"   <{r['tag']}> id='{r['id']}' class='{r['className']}'")
        print(f"     parent: <{r['parentTag']}> class='{r['parentClass']}'")
        print(f"     grandparent: <{r['grandParentTag']}> class='{r['grandParentClass']}'")
        print(f"     HTML: {r['outerHTML']}")
        print()

    # Busca a seção do volante
    print("\n10. Dump da seção do volante (se existir)...")
    volante_html = page.evaluate("""
        () => {
            // Procura pelo heading "Preencha sua aposta" e pega o container pai
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, div');
            for (const h of headings) {
                if (h.textContent.includes('Preencha sua aposta')) {
                    // Pega o container pai mais relevante
                    let parent = h.parentElement;
                    if (parent) {
                        return parent.innerHTML.substring(0, 3000);
                    }
                }
            }
            return 'NÃO ENCONTRADO';
        }
    """)
    print(f"   {volante_html[:2000]}")

    print("\n✅ Diagnóstico concluído! Feche o navegador quando quiser.")
    page.wait_for_timeout(5000)
    context.close()
