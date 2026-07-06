/**
 * LotoSmart Worker — DOM Utils
 * 
 * Funções utilitárias para interagir com a DOM da página da Caixa Econômica,
 * substituindo as funcionalidades do Playwright.
 */

/**
 * Aguarda um elemento aparecer na DOM.
 * @param {string} selector - O seletor CSS do elemento.
 * @param {number} timeout - Tempo máximo de espera em ms.
 * @returns {Promise<Element>}
 */
export function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        // Se já existe, retorna imediatamente
        const element = document.querySelector(selector);
        if (element) {
            return resolve(element);
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        if (timeout > 0) {
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout de ${timeout}ms aguardando o seletor: ${selector}`));
            }, timeout);
        }
    });
}

/**
 * Aguarda uma função retornar verdadeiro. Útil para verificar propriedades customizadas.
 * @param {Function} predicate - Função que retorna booleano.
 * @param {number} timeout - Tempo máximo em ms.
 * @param {number} interval - Intervalo de verificação em ms.
 * @returns {Promise<void>}
 */
export function waitForFunction(predicate, timeout = 10000, interval = 100) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const timer = setInterval(() => {
            try {
                if (predicate()) {
                    clearInterval(timer);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(timer);
                    reject(new Error(`Timeout de ${timeout}ms aguardando a função`));
                }
            } catch (err) {
                clearInterval(timer);
                reject(err);
            }
        }, interval);
    });
}

/**
 * Pausa a execução assíncrona por um tempo determinado.
 * @param {number} ms - Tempo em milissegundos.
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Dispara um clique real em um elemento usando MouseEvents.
 * Isso garante que frameworks JS (Angular, React) detectem o evento.
 * @param {Element} element - O elemento DOM.
 */
export function simulateClick(element) {
    if (!element) return false;
    
    try {
        // Tenta clique nativo primeiro (mais seguro se for um botão normal)
        element.click();
    } catch (e) {}
    
    // Dispara eventos artificiais como fallback (garantia para Angular/React/Vue)
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(eventType => {
        try {
            const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });
            element.dispatchEvent(event);
        } catch(e){}
    });
    
    return true;
}

/**
 * Encontra um elemento baseado em parte do seu texto (case-insensitive).
 * Substitui o `:contains` do jQuery ou o `:has-text` do Playwright.
 * @param {string} selector - Seletor base (ex: 'a', 'button')
 * @param {string} text - Texto que o elemento deve conter
 * @returns {Element|null}
 */
export function findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    const search = text.toLowerCase().trim();
    
    for (const el of elements) {
        if (el.textContent.toLowerCase().includes(search)) {
            return el;
        }
    }
    return null;
}
