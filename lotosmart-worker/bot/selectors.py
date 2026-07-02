"""
bot/selectors.py — Seletores CSS/XPath centralizados para o site Loterias Online da Caixa.

IMPORTANTE: Se a Caixa alterar o HTML do site, basta atualizar este arquivo.
Nenhum outro módulo deve conter seletores hardcoded.
"""

# ═══════════════════════════════════════════════════
# LOGIN MANUAL E MONITORAMENTO
# ═══════════════════════════════════════════════════
LOGIN = {
    # Indicador de login bem-sucedido
    "logged_indicator": 'text="Sair", text="Bem-vindo", text="Bem vindo", a:has-text("Minha Conta"), span:has-text("Olá,"), text="Olá,", a[href*="logout"], a[ng-click*="logout"], .logout, #usuario-logado, .nome-usuario',
}

# ═══════════════════════════════════════════════════
# SELEÇÃO DE NÚMEROS (PÁGINA DE APOSTA)
# ═══════════════════════════════════════════════════
GAME = {
    # Container dos números clicáveis (geralmente uma lista ou grid)
    "numbers_container": 'ul#num-do-volante, ul.num-do-volante, .numeros-aposta, #volante',
    # Padrão para número individual (substituir {n} pelo número)
    # Procuramos o elemento clicável contendo exatamente o número correspondente formatado com 2 dígitos
    "number_button": 'li a:has-text("{n}"), li button:has-text("{n}"), a[id*="n-{n}"], a:has-text("{n}")',
    # Classe que indica se o número está selecionado/ativo
    "number_selected_class": "selecionado",
    # Botão "Limpar" seleção do volante atual
    "clear_selection": 'a:has-text("Limpar"), button:has-text("Limpar"), .limpar',
    # Botão "Colocar no carrinho" / "Adicionar ao carrinho"
    "add_to_cart": 'a#colocar-no-carrinho, button#colocar-no-carrinho, a:has-text("Colocar no carrinho"), button:has-text("Colocar no carrinho")',
    # Confirmação de que o jogo foi adicionado (se aplicável)
    "cart_confirmation": '.mensagem-sucesso, .toast-success, div:has-text("adicionado com sucesso")',
}

# ═══════════════════════════════════════════════════
# CARRINHO E CHECKOUT
# ═══════════════════════════════════════════════════
CART = {
    # Quantidade de jogos no carrinho (geralmente uma badge vermelha/laranja perto do carrinho)
    "cart_count": '.carrinho-quantidade, .cart-count, span.badge, #carrinho-qtd',
    # Valor total do carrinho
    "cart_total": '#carrinho-total, .carrinho-total, .valor-total',
    # Botão "Ir para pagamento" / "Finalizar compra"
    "checkout_button": 'a:has-text("Ir para pagamento"), button:has-text("Ir para pagamento"), a:has-text("Finalizar compra"), button:has-text("Finalizar compra")',
}

# ═══════════════════════════════════════════════════
# PAGAMENTO
# ═══════════════════════════════════════════════════
PAYMENT = {
    # Opção PIX (caso precise clicar na opção)
    "pix_option": 'input[value="pix"], label:has-text("PIX"), .pix-option, label[for*="pix"]',
    # Botão confirmar pagamento
    "confirm_payment": 'button:has-text("Gerar PIX"), button:has-text("Confirmar pagamento"), button:has-text("Pagar")',
    # QR Code do PIX (se exibido)
    "pix_qr_code": 'img.qr-code, canvas[class*="qr"], img[src*="qr"]',
    # Código PIX copia-e-cola
    "pix_copy_paste": 'input[readonly], textarea[readonly], .codigo-pix, input[id*="pix"]',
    # Protocolo / comprovante após pagamento
    "protocol_number": '.protocolo, .numero-protocolo, td:has-text("Protocolo") + td, span:has-text("Protocolo")',
}

# ═══════════════════════════════════════════════════
# NAVEGAÇÃO GERAL
# ═══════════════════════════════════════════════════
NAV = {
    # Links para as páginas de aposta das modalidades no menu
    "lotofacil_link": 'a[href*="lotofacil"]',
    "quina_link": 'a[href*="quina"]',
    "cart_link": 'a[href*="carrinho"]',
}

