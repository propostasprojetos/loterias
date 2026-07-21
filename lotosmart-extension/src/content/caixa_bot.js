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
 * Seleciona o Mês de Sorte para a loteria Dia de Sorte.
 * @param {number|null} mesEspecifico - Número do mês (1-12) ou null para aleatório.
 */
async function selectDiaDeSorteMonth(mesEspecifico = null) {
    const MONTH_NAMES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    // 1. Estratégia por atributo ng-model ou data (AngularJS)
    const allElements = document.querySelectorAll('a, button, li, span, div');
    for (const el of allElements) {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        const targetMonth = mesEspecifico ? MONTH_NAMES[mesEspecifico] : null;
        if (targetMonth && text === targetMonth) {
            simulateClick(el);
            return true;
        }
    }

    // 2. Procura pelo cabeçalho Mês de Sorte e clica no botão do mês desejado ou aleatório
    const label = findElementByText('h2, h3, h4, label, p, span', 'Mês de Sorte') ||
                  findElementByText('h2, h3, h4, label, p, span', 'mês');
    if (label) {
        const parent = label.closest('div, section, form');
        if (parent) {
            const buttons = Array.from(parent.querySelectorAll('a, button, li'));
            if (buttons.length > 0) {
                let target = null;
                if (mesEspecifico && mesEspecifico >= 1 && mesEspecifico <= 12) {
                    // Tenta encontrar o mês pelo texto
                    const mName = MONTH_NAMES[mesEspecifico].toLowerCase();
                    target = buttons.find(b =>
                        (b.innerText || b.textContent || '').trim().toLowerCase().startsWith(mName.substring(0, 3))
                    );
                }
                simulateClick(target || buttons[Math.floor(Math.random() * buttons.length)]);
                return true;
            }
        }
    }

    return false;
}

/**
 * Seleciona o Time do Coração para a loteria Timemania.
 * @param {string|null} timeEspecifico - Nome exato do time ou null para aleatório.
 */
async function selectTimemaniaTeam(timeEspecifico = null) {
    const carrossel = document.getElementById('carrossel_timemania');
    const teamImgs  = document.querySelectorAll('#carrossel_timemania img[name="btnTime"], img.data-selecionar-time-do-coracao');
    const pool      = teamImgs.length > 0 ? teamImgs : (carrossel ? carrossel.querySelectorAll('li img') : []);

    if (pool.length === 0) return false;

    if (timeEspecifico) {
        // Tenta encontrar o time pelo texto do elemento irmão span.nomeTime
        for (const img of pool) {
            const li = img.closest('li');
            if (!li) continue;
            const nomeEl = li.querySelector('span.nomeTime, span');
            const nome   = (nomeEl?.innerText || nomeEl?.textContent || '').trim();
            if (nome.toLowerCase().includes(timeEspecifico.toLowerCase())) {
                simulateClick(img);
                return true;
            }
        }
    }

    // Fallback: aleatório
    const randomImg = pool[Math.floor(Math.random() * pool.length)];
    simulateClick(randomImg);
    return true;
}

/**
 * Seleciona os trevos para a loteria +Milionária.
 * @param {number[]|null} trevosEspecificos - Array com os trevos a clicar (1-6), ou null para aleatório.
 */
async function selectMaisMilionariaTrevos(trevosEspecificos = null) {
    let indices;

    if (trevosEspecificos && trevosEspecificos.length >= 2) {
        // Usa os trevos específicos passados pela inserção manual
        indices = trevosEspecificos.filter(n => n >= 1 && n <= 6);
    } else {
        // Aleatório: 2 trevos distintos
        indices = [];
        while (indices.length < 2) {
            const idx = Math.floor(Math.random() * 6) + 1;
            if (!indices.includes(idx)) indices.push(idx);
        }
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

    return clicked >= 2;
}

/**
 * Ajusta o combobox "Quantidade de números da aposta" no site da Caixa.
 * @param {number} targetQty - Quantidade de dezenas que queremos jogar.
 */
async function selectGameSize(targetQty) {
    try {
        const selects = document.querySelectorAll('select');
        let targetSelect = null;
        let targetOption = null;

        for (const select of selects) {
            const options = Array.from(select.options);
            // Procura a option cujo texto seja exatamente a quantidade desejada (ex: "7", "8")
            const opt = options.find(o => o.text.trim() === String(targetQty));
            if (opt) {
                // Checagem de segurança para não pegar selects de mês (ex: Dia de Sorte)
                const isMonthSelect = options.some(o => o.text.toLowerCase().includes('janeiro') || o.text.toLowerCase().includes('fevereiro'));
                if (!isMonthSelect) {
                    targetSelect = select;
                    targetOption = opt;
                    break; // Encontrou o select correto
                }
            }
        }

        if (targetSelect && targetOption) {
            // Só dispara se o valor atual for diferente
            if (targetSelect.value !== targetOption.value) {
                targetSelect.value = targetOption.value;
                
                // Dispara os eventos padrão do DOM
                targetSelect.dispatchEvent(new Event('input', { bubbles: true }));
                targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Atribui um ID temporário se não tiver, para achá-lo no script injetado
                if (!targetSelect.id) targetSelect.id = 'lotosmart-qty-select';
                
                // Injeta script para forçar o Angular 1.x a atualizar o model e a tela
                const script = document.createElement('script');
                script.textContent = `
                    try {
                        const sel = document.getElementById('${targetSelect.id}');
                        if (sel && window.angular) {
                            const ngEl = angular.element(sel);
                            ngEl.triggerHandler('change');
                            const scope = ngEl.scope();
                            if (scope && !scope.$$phase) {
                                scope.$apply();
                            }
                        }
                    } catch(e) {
                        console.error('Erro ao injetar scope apply:', e);
                    }
                `;
                document.body.appendChild(script);
                script.remove();

                console.log(`[selectGameSize] Ajustado select para ${targetQty} números via Angular Injection.`);
                await sleep(1000); // Aguarda a tela piscar/liberar os números extras
            }
            return true;
        }
    } catch (e) {
        console.warn('Erro ao tentar ajustar selectGameSize:', e);
    }
    return false;
}

/**
 * Preenche e adiciona um único jogo ao carrinho.
 * @param {number[]|Object} numbers - Array de números OU objeto { dezenas, trevos?, mes?, time? }
 * @param {string} lotteryName - Nome da modalidade para os logs
 * @returns {Promise<boolean>}
 */
export async function executeSingleGame(numbers, lotteryName = 'Loterias') {
    try {
        // Suporta formato legado (array) e novo formato (objeto com dezenas + campos extras)
        const isObject = numbers && !Array.isArray(numbers) && typeof numbers === 'object';
        const dezenas  = isObject ? (numbers.dezenas || []) : numbers;
        const trevosEspecificos = isObject ? (numbers.trevos || null) : null;
        const mesEspecifico     = isObject ? (numbers.mes   || null) : null;
        const timeEspecifico    = isObject ? (numbers.time  || null) : null;

        console.log(`🎲 ${lotteryName}: Preenchendo jogo: ${dezenas.join(',')}` +
            (trevosEspecificos ? ` | Trevos: ${trevosEspecificos}` : '') +
            (mesEspecifico     ? ` | Mês: ${mesEspecifico}` : '') +
            (timeEspecifico    ? ` | Time: ${timeEspecifico}` : '')
        );

        // 1. Limpar volante atual por segurança
        clickClearVolante();
        await sleep(500);

        // 1.5 Ajustar quantidade de dezenas da aposta no Select (se aplicável)
        const nameNormalized = lotteryName.toLowerCase().replace(/-/g, '').replace(/\s/g, '').replace(/\+/g, '');
        // Super Sete, Lotomania e Timemania não precisam de ajuste de tamanho de dezenas
        if (nameNormalized !== 'supersete' && nameNormalized !== 'lotomania' && nameNormalized !== 'timemania') {
            await selectGameSize(dezenas.length);
        }

        // 2. Clicar em cada número sequencialmente de acordo com a regra da modalidade

        if (nameNormalized === 'supersete') {
            // Super Sete: cada posição do array = um dígito (col 0 a 6)
            for (let col = 0; col < dezenas.length; col++) {
                const num = dezenas[col];
                const success = clickSuperSeteNumber(col, num);
                if (!success) {
                    console.error(`🎲 ${lotteryName}: Falha ao encontrar o número ${num} na coluna ${col + 1}`);
                    return false;
                }
                await sleep(TIMEOUT_BETWEEN_CLICKS);
            }
        } else {
            // Outras loterias: ordena e clica nos números
            const sorted = [...dezenas].sort((a, b) => a - b);
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
            const monthSuccess = await selectDiaDeSorteMonth(mesEspecifico);
            if (!monthSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar o Mês de Sorte.`);
            }
        } else if (nameNormalized === 'timemania') {
            const teamSuccess = await selectTimemaniaTeam(timeEspecifico);
            if (!teamSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar o Time do Coração.`);
            }
        } else if (nameNormalized === 'maismilionaria' || nameNormalized === 'milionaria') {
            const trevosSuccess = await selectMaisMilionariaTrevos(trevosEspecificos);
            if (!trevosSuccess) {
                console.warn(`🎲 ${lotteryName}: Não conseguiu selecionar os Trevos.`);
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
