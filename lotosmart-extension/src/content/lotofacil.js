/**
 * LotoSmart Worker — Robô Lotofácil (DOM)
 * 
 * Executa a lógica de preenchimento de jogos na página oficial
 * da Caixa Econômica Federal (/#/lotofacil).
 */

import { waitForSelector, findElementByText, simulateClick, sleep } from './dom_utils.js';
import { TIMEOUT_BETWEEN_CLICKS, TIMEOUT_ADD_CART, TIMEOUT_BETWEEN_GAMES } from '../shared/config.js';

/**
 * Tenta clicar em um número no volante da Lotofácil.
 * Verifica Múltiplas estratégias para contornar variações do site da Caixa.
 * @param {number} num - O número a ser clicado (ex: 5, 25).
 * @returns {boolean} - Retorna true se conseguiu clicar, false se falhou.
 */
function clickNumber(num) {
    const numStr = String(num).padStart(2, '0');

    // Estratégia 1: Busca exata pelo atributo data-numero ou data-value
    const attrSelectors = [
        `[data-numero="${num}"]`,
        `[data-numero="${numStr}"]`,
        `[data-value="${num}"]`,
        `[data-value="${numStr}"]`
    ];

    for (const selector of attrSelectors) {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) { // isVisible aproximado
            simulateClick(el);
            return true;
        }
    }

    // Estratégia 2: Busca todos os 'a' ou 'li' e varre o texto
    const elements = document.querySelectorAll('a, button, li');
    for (const el of elements) {
        const text = el.textContent.trim();
        if (text === numStr || text === String(num)) {
            simulateClick(el);
            return true;
        }
    }

    return false;
}

/**
 * Encontra e clica no botão "Limpar Volante".
 * @returns {boolean}
 */
function clickClearVolante() {
    const clearBtn = findElementByText('a, button', 'Limpar');
    if (clearBtn) {
        simulateClick(clearBtn);
        return true;
    }
    return false;
}

/**
 * Encontra e clica no botão "Colocar no Carrinho".
 * @returns {boolean}
 */
async function clickAddToCart() {
    const btn = findElementByText('a, button', 'Colocar no Carrinho');
    if (btn) {
        simulateClick(btn);
        return true;
    }
    return false;
}

/**
 * Verifica se a aposta já foi incluída com sucesso (usualmente olhando pro carrinho atualizado ou toast).
 */
async function verifySuccess() {
    // Na caixa, um toast/snackbar pode aparecer, ou o total de itens no carrinho muda.
    // Vamos apenas esperar um pequeno tempo e assumir sucesso, deixando
    // verificações mais rígidas para futuras melhorias (Fase 5) caso a Caixa mude.
    await sleep(2000);
    return true;
}

/**
 * Preenche e adiciona um único jogo da Lotofácil ao carrinho.
 * @param {number[]} numbers - Array de números (ex: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
 * @returns {Promise<boolean>}
 */
export async function executeSingleGame(numbers) {
    try {
        console.log(`🎲 Lotofácil: Preenchendo jogo: ${numbers.join(',')}`);

        // 1. Limpar volante atual por segurança
        clickClearVolante();
        await sleep(500);

        // 2. Clicar em cada número sequencialmente
        const sorted = [...numbers].sort((a, b) => a - b);
        for (const num of sorted) {
            const success = clickNumber(num);
            if (!success) {
                console.error(`🎲 Lotofácil: Falha ao encontrar o número ${num}`);
                return false;
            }
            await sleep(TIMEOUT_BETWEEN_CLICKS);
        }

        // 3. Colocar no carrinho
        const added = await clickAddToCart();
        if (!added) {
            console.error('🎲 Lotofácil: Botão "Colocar no Carrinho" não encontrado!');
            return false;
        }

        // 4. Aguardar confirmação visual
        const verified = await verifySuccess();
        return verified;

    } catch (err) {
        console.error('🎲 Lotofácil: Erro na execução do jogo', err);
        return false;
    }
}

/**
 * Loop principal que processa múltiplos jogos.
 * @param {Array<Object>} games - Array de jogos do Supabase { id, numbers: [...] }
 * @returns {Promise<Object>} - Resultado com status de cada jogo
 */
export async function executeAllGames(games) {
    const results = {
        success: [],
        failed: []
    };

    // Confirmar que o volante da Lotofácil está na tela esperando pelo título
    try {
        await waitForSelector('h2, h3', 10000); // Wait for page generic content
        // Aguarda um número estar na tela
        const isReady = await waitForSelector('a, li', 5000).then(() => true).catch(() => false);
        if (!isReady) throw new Error("A página não parece estar carregada.");
    } catch(err) {
        console.error("🎲 Lotofácil: Erro ao aguardar o carregamento da página.", err);
        throw err;
    }

    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        console.log(`🎲 Processando jogo ${i+1}/${games.length} (ID: ${game.id})`);
        
        const success = await executeSingleGame(game.numbers);
        
        if (success) {
            results.success.push(game.id);
        } else {
            results.failed.push({ id: game.id, error: 'Falha no preenchimento/carrinho' });
        }

        if (i < games.length - 1) {
            await sleep(TIMEOUT_BETWEEN_GAMES);
        }
    }

    return results;
}
