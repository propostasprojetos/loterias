"""
bot/selectors.py — Seletores CSS/XPath centralizados para o site Loterias Online da Caixa.

IMPORTANTE: Se a Caixa alterar o HTML do site, basta atualizar este arquivo.
Nenhum outro módulo deve conter seletores hardcoded.

Os seletores abaixo são baseados em pesquisa da estrutura do site.
Podem precisar de ajuste após inspeção real do HTML em produção.
"""


# ═══════════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════════
LOGIN = {
    # Campo CPF na tela de login
    "cpf_input": 'input[name="cpf"], input#cpf, input[placeholder*="CPF"]',
    # Campo senha
    "password_input": 'input[name="senha"], input[type="password"]',
    # Botão de entrar
    "submit_button": 'button[type="submit"], button.btn-entrar, input[type="submit"]',
    # Indicador de login bem-sucedido (elemento que só aparece logado)
    "logged_indicator": '.usuario-logado, .nome-usuario, [class*="logged"], [class*="user-name"]',
    # Modal de verificação por email (quando aparece)
    "email_verification_modal": '.modal-verificacao, [class*="verificacao"], [class*="verification"]',
    "email_code_input": 'input[name="codigo"], input[class*="codigo"], input[placeholder*="código"]',
    "email_code_submit": 'button.btn-confirmar, button[class*="confirmar"]',
}


# ═══════════════════════════════════════════════════
# SELEÇÃO DE NÚMEROS (PÁGINA DE APOSTA)
# ═══════════════════════════════════════════════════
GAME = {
    # Container dos números clicáveis
    "numbers_container": '.numeros-aposta, .numbers-container, [class*="numeros"]',
    # Padrão para número individual (substituir {n} pelo número)
    # Ex: botão do número 7 → span[data-numero="7"] ou li com texto "07"
    "number_button": '[data-numero="{n}"], .numero-{n}, li.numero:nth-child({n})',
    # Número selecionado (classe que indica ativo)
    "number_selected_class": "selecionado",
    # Botão "Limpar" seleção
    "clear_selection": 'button.limpar, a.limpar, [class*="limpar"]',
    # Botão "Adicionar ao carrinho" / "Colocar no carrinho"
    "add_to_cart": 'button.adicionar, button[class*="carrinho"], [class*="add-cart"]',
    # Seletor para "Surpresinha" (preenche aleatoriamente, útil como fallback)
    "surpresinha": 'button.surpresinha, [class*="surpresinha"]',
    # Confirmação de que o jogo foi adicionado
    "cart_confirmation": '.mensagem-sucesso, [class*="sucesso"], .toast-success',
}


# ═══════════════════════════════════════════════════
# CARRINHO
# ═══════════════════════════════════════════════════
CART = {
    # Quantidade de jogos no carrinho
    "cart_count": '.carrinho-quantidade, .cart-count, [class*="cart-badge"]',
    # Valor total do carrinho
    "cart_total": '.carrinho-total, .valor-total, [class*="total"]',
    # Botão "Ir para pagamento" / "Finalizar"
    "checkout_button": 'button.finalizar, button[class*="pagamento"], [class*="checkout"]',
    # Lista de itens no carrinho
    "cart_items": '.item-carrinho, .cart-item, [class*="cart-item"]',
    # Botão de remover item do carrinho
    "remove_item": '.remover-item, .remove-cart-item, [class*="remove"]',
}


# ═══════════════════════════════════════════════════
# PAGAMENTO
# ═══════════════════════════════════════════════════
PAYMENT = {
    # Opção PIX
    "pix_option": 'input[value="pix"], label[for*="pix"], [class*="pix"]',
    # Botão confirmar pagamento
    "confirm_payment": 'button.confirmar-pagamento, button[class*="confirm"], [class*="pagar"]',
    # QR Code do PIX (se exibido)
    "pix_qr_code": 'img.qr-code, [class*="qr-code"], canvas[class*="qr"]',
    # Código PIX copia-e-cola
    "pix_copy_paste": 'input[class*="pix-code"], textarea[class*="pix"], .codigo-pix',
    # Protocolo / comprovante após pagamento
    "protocol_number": '.protocolo, .numero-protocolo, [class*="protocol"], [class*="comprovante"]',
    # Confirmação de pagamento concluído
    "payment_success": '.pagamento-confirmado, [class*="sucesso"], [class*="success"]',
}


# ═══════════════════════════════════════════════════
# NAVEGAÇÃO GERAL
# ═══════════════════════════════════════════════════
NAV = {
    # Link para acessar a Lotofácil
    "lotofacil_link": 'a[href*="lotofacil"], [class*="lotofacil"]',
    # Link para acessar a Quina
    "quina_link": 'a[href*="quina"], [class*="quina"]',
    # Link para o carrinho
    "cart_link": 'a[href*="carrinho"], .carrinho-link, [class*="cart-link"]',
    # Botão/link de logout
    "logout": 'a[href*="logout"], button.logout, [class*="sair"]',
}
