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

    // Estratégia 0: O ID nativo exato da Caixa (ex: #n01, #n25) ou sem o zero à esquerda (#n1)
    let exactIdEl = document.getElementById(`n${numStr}`);
    if (!exactIdEl) {
        exactIdEl = document.getElementById(`n${num}`);
    }
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
 * Encontra um elemento baseado em texto dentro de um elemento pai específico.
 */
function findElementByTextInside(parent, selector, text) {
    const elements = parent.querySelectorAll(selector);
    const search = text.trim();
    for (const el of elements) {
        if (el.textContent.trim() === search) {
            return el;
        }
    }
    return null;
}

/**
 * Seleciona o número correto na coluna específica do Super Sete.
 */
function clickSuperSeteNumber(colIndex, num) {
    // O Super Sete tem 7 colunas (0 a 6) e 10 dezenas por coluna (0 a 9).
    // Conforme mapeamento do DOM da Caixa, os IDs vão de n1 a n70 de forma posicional:
    // ID = 7 * num + colIndex + 1
    const targetId = `n${7 * num + colIndex + 1}`;
    const button = document.getElementById(targetId);
    
    if (button) {
        simulateClick(button);
        return true;
    }
    return false;
}

/**
 * Seleciona um Mês de Sorte aleatório para a loteria Dia de Sorte.
 */
async function selectDiaDeSorteMonth() {
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    
    // 1. Tenta achar um dropdown de meses
    const select = document.querySelector('select[id*="mes"], select[class*="mes"]');
    if (select) {
        const options = select.options;
        if (options.length > 1) {
            const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
            select.selectedIndex = randomIndex;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    // 2. Tenta achar botões dos meses no DOM
    for (const m of months) {
        const btn = findElementByText('a, button, li, span', m);
        if (btn) {
            const container = btn.closest('ul, div.grid, div.container-meses');
            if (container) {
                const allMonthButtons = container.querySelectorAll('a, button, li, span');
                if (allMonthButtons.length > 0) {
                    const randomBtn = allMonthButtons[Math.floor(Math.random() * allMonthButtons.length)];
                    simulateClick(randomBtn);
                    return true;
                }
            } else {
                simulateClick(btn);
                return true;
            }
        }
    }

    // 3. Fallback procurando cabeçalho
    const label = findElementByText('h2, h3, h4, label, span', 'Mês de Sorte');
    if (label) {
        const parent = label.closest('div, section');
        if (parent) {
            const buttons = parent.querySelectorAll('a, button, li');
            if (buttons.length > 0) {
                simulateClick(buttons[Math.floor(Math.random() * buttons.length)]);
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Seleciona um Time do Coração aleatório para a loteria Timemania.
 */
async function selectTimemaniaTeam() {
    // Procura as imagens de botões de time com name="btnTime" ou classe "data-selecionar-time-do-coracao"
    const teamImgs = document.querySelectorAll('#carrossel_timemania img[name="btnTime"], img.data-selecionar-time-do-coracao');
    
    if (teamImgs.length > 0) {
        const randomImg = teamImgs[Math.floor(Math.random() * teamImgs.length)];
        simulateClick(randomImg);
        return true;
    }

    // Fallback: se não achar as imagens específicas, procura por qualquer nó clicável no carrossel de times
    const carrossel = document.getElementById('carrossel_timemania');
    if (carrossel) {
        const items = carrossel.querySelectorAll('li img, li');
        if (items.length > 0) {
            simulateClick(items[Math.floor(Math.random() * items.length)]);
            return true;
        }
    }
    
    return false;
}

/**
 * Seleciona 2 trevos aleatórios para a loteria +Milionária.
 */
async function selectMaisMilionariaTrevos() {
    // Os trevos da +Milionária são tags <img> dentro de #step3 com IDs trevo1 a trevo6
    const indices = [];
    while (indices.length < 2) {
        const idx = Math.floor(Math.random() * 6) + 1; // 1 a 6
        if (!indices.includes(idx)) indices.push(idx);
    }
    
    let clicked = 0;
    for (const num of indices) {
        const img = document.getElementById(`trevo${num}`);
        if (img) {
            simulateClick(img);
            clicked++;
            await sleep(TIMEOUT_BETWEEN_CLICKS);
        }
    }
    
    return clicked === 2;
}

/**
 * Preenche e adiciona um único jogo ao carrinho.
 * @param {number[]} numbers - Array de números
 * @param {string} lotteryName - Nome da modalidade para os logs
 * @returns {Promise<boolean>}
 */
export async function executeSingleGame(numbers, lotteryName = 'Loterias') {
    try {
        console.log(`🎲 ${lotteryName}: Preenchendo jogo: ${numbers.join(',')}`);

        // 1. Limpar volante atual por segurança
        clickClearVolante();
        await sleep(500);

        // 2. Clicar em cada número sequencialmente de acordo com a regra da modalidade
        const nameNormalized = lotteryName.toLowerCase().replace(/-/g, '');
        
        if (nameNormalized === 'supersete') {
            // Lógica especial para Super Sete: números correspondem à seleção por coluna [col0, col1, ...]
            for (let col = 0; col < numbers.length; col++) {
                const num = numbers[col];
                const success = clickSuperSeteNumber(col, num);
                if (!success) {
                    console.error(`🎲 ${lotteryName}: Falha ao encontrar o número ${num} na coluna ${col + 1}`);
                    return false;
                }
                await sleep(TIMEOUT_BETWEEN_CLICKS);
            }
        } else {
            // Outras loterias: ordene e clique nos números
            const sorted = [...numbers].sort((a, b) => a - b);
            for (const num of sorted) {
                const success = clickNumber(num);
                if (!success) {
                    console.error(`🎲 ${lotteryName}: Falha ao encontrar o número ${num}`);
                    return false;
                }
                await sleep(TIMEOUT_BETWEEN_CLICKS);
            }
        }

        // 3. Preenchimento de campos secundários obrigatórios
        if (nameNormalized === 'diadesorte') {
            const monthSuccess = await selectDiaDeSorteMonth();
            if (!monthSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar o Mês de Sorte automaticamente.`);
            }
        } else if (nameNormalized === 'timemania') {
            const teamSuccess = await selectTimemaniaTeam();
            if (!teamSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar o Time do Coração automaticamente.`);
            }
        } else if (nameNormalized === 'maismilionaria') {
            const trevosSuccess = await selectMaisMilionariaTrevos();
            if (!trevosSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar os Trevos automaticamente.`);
            }
        }

        // 4. Colocar no carrinho
        const added = await clickAddToCart();
        if (!added) {
            console.error(`🎲 ${lotteryName}: Botão "Colocar no Carrinho" não encontrado!`);
            return false;
        }

        // 5. Aguardar confirmação visual
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
