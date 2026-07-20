/**
 * LotoSmart Worker — Robô Genérico (DOM)
 * 
 * Executa a lógica de preenchimento de jogos na página oficial
 * da Caixa Econômica Federal. Agnostico a loterias (suporta todas).
 */

import { waitForSelector, findElementByText, simulateClick, sleep, waitForFunction } from './dom_utils.js';
import { TIMEOUT_BETWEEN_CLICKS, TIMEOUT_ADD_CART, TIMEOUT_BETWEEN_GAMES } from '../shared/config.js';

/**
 * Tenta clicar em um número no volante.
 * Verifica Múltiplas estratégias para contornar variações do site da Caixa.
 * @param {number} num - O número a ser clicado (ex: 5, 25).
 * @returns {boolean} - Retorna true se conseguiu clicar, false se falhou.
 */
function clickNumber(num) {
    const numStr = String(num).padStart(2, '0');

    // Estratégia 0: O ID nativo exato da Caixa (ex: #n01, #n25)
    const exactIdEl = document.getElementById(`n${numStr}`);
    if (exactIdEl) {
        simulateClick(exactIdEl);
        return true;
    }

    // Estratégia 1: Busca exata pelo atributo data-numero ou data-value
    const attrSelectors = [
        `[data-numero="${num}"]`,
        `[data-numero="${numStr}"]`,
        `[data-value="${num}"]`,
        `[data-value="${numStr}"]`
    ];

    for (const selector of attrSelectors) {
        const el = document.querySelector(selector);
        // Verifica se elemento existe e tem tamanho na tela
        if (el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.offsetParent !== null)) {
            simulateClick(el);
            return true;
        }
    }

    // Estratégia 2: Busca todos os elementos possivelmente clicáveis e varre o texto exato
    const elements = document.querySelectorAll('a, button, li, span, div.dezena, label');
    for (const el of elements) {
        // Usa o innerText ou textContent removendo todos os espaços em branco extras (caso tenham quebras de linha ou zeros ocultos)
        const text = (el.innerText || el.textContent || '').trim();
        if (text === numStr || text === String(num)) {
            simulateClick(el);
            return true;
        }
    }

    // Estratégia 3 (Fallback): Percorre recursivamente buscando apenas o nó de texto
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
        if (span.textContent.trim() === numStr) {
            simulateClick(span);
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
 * Verifica se a aposta já foi incluída com sucesso (olhando pro carrinho ou toast).
 */
async function verifySuccess() {
    try {
        await waitForFunction(() => {
            const bodyText = document.body.innerText.toLowerCase();
            // A Caixa pode apresentar uma mensagem de sucesso ou 
            // no mínimo o botão de "Ir para pagamento" fica disponível/atualizado
            return bodyText.includes('aposta adicionada') || 
                   bodyText.includes('sucesso') ||
                   bodyText.includes('ir para pagamento') ||
                   document.querySelector('.badge'); // Ícone de contador do carrinho
        }, 5000, 250);
        return true;
    } catch (err) {
        throw new Error('Falha ao confirmar adição ao carrinho (timeout visual). O botão pode não ter funcionado.');
    }
}

/**
 * Preenche e adiciona um único jogo ao carrinho.
 * @param {number[]} numbers - Array de números (ex: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
 * @param {string} lotteryName - Nome da modalidade para os logs
 * @returns {Promise<boolean>}
 */
export async function executeSingleGame(numbers, lotteryName = 'Loterias') {
    try {
        console.log(`🎲 ${lotteryName}: Preenchendo jogo: ${numbers.join(',')}`);

        // 1. Limpar volante atual por segurança
        clickClearVolante();
        await sleep(500);

        // 2. Clicar em cada número sequencialmente
        const sorted = [...numbers].sort((a, b) => a - b);
        for (const num of sorted) {
            const success = clickNumber(num);
            if (!success) {
                console.error(`🎲 ${lotteryName}: Falha ao encontrar o número ${num}`);
                return false;
            }
            await sleep(TIMEOUT_BETWEEN_CLICKS);
        }

        // 3. Colocar no carrinho
        const added = await clickAddToCart();
        if (!added) {
            console.error(`🎲 ${lotteryName}: Botão "Colocar no Carrinho" não encontrado!`);
            return false;
        }

        // 4. Aguardar confirmação visual
        const verified = await verifySuccess();
        return verified;

    } catch (err) {
        console.error(`🎲 ${lotteryName}: Erro na execução do jogo`, err);
        return false;
    }
}

/**
 * Loop principal que processa múltiplos jogos.
 * @param {Array<Object>} games - Array de jogos do Supabase { id, numbers: [...] }
 * @param {string} lotteryName - Slug ou nome da loteria para logging
 * @returns {Promise<Object>} - Resultado com status de cada jogo
 */
export async function executeAllGames(games, lotteryName = 'Loterias') {
    const results = {
        success: [],
        failed: []
    };

    // Confirmar que o volante está na tela de fato
    try {
        // Aguarda a renderização básica
        await waitForSelector('h2, h3', 10000); 
        
        // Sincronização Estrita: Aguarda até que o texto de aposta OU os números existam
        const isReady = await waitForFunction(() => {
            const hasTitle = !!findElementByText('h2, h3, span', 'Preencha sua aposta');
            const hasNumber = !!document.querySelector('[data-numero="01"]');
            return hasTitle || hasNumber;
        }, 15000, 250).then(() => true).catch(() => false);

        if (!isReady) throw new Error(`A página da modalidade ${lotteryName} não carregou completamente os números ou o volante.`);
    } catch(err) {
        console.error(`🎲 ${lotteryName}: Erro ao aguardar o carregamento da página.`, err);
        throw err;
    }

    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        console.log(`🎲 Processando jogo ${i+1}/${games.length} (ID: ${game.id})`);
        
        const success = await executeSingleGame(game.numbers, lotteryName);
        
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
