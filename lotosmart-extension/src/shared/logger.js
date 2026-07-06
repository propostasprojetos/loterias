/**
 * LotoSmart Worker — Sistema de Logs Estruturados
 * 
 * Fornece logging padronizado com prefixos, timestamps e níveis
 * para facilitar o debug e a auditoria de operações da extensão.
 * 
 * Uso:
 *   import { createLogger } from '../shared/logger.js';
 *   const log = createLogger('QueueManager');
 *   log.info('Job recebido', { jobId: '...' });
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = {
  debug: 'color: #636880',
  info:  'color: #4ecdc4',
  warn:  'color: #e8b44d',
  error: 'color: #e85d5d',
};

const PREFIX = '🎲 LotoSmart';

/**
 * Cria uma instância de logger para um módulo específico.
 * @param {string} moduleName — Nome do módulo (ex: 'ServiceWorker', 'QueueManager')
 * @returns {{ debug, info, warn, error }} — Métodos de log
 */
export function createLogger(moduleName) {
  function _log(level, message, data) {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const tag = `[${PREFIX}][${ts}][${moduleName}]`;

    const args = [`%c${tag} ${message}`, COLORS[level]];
    if (data !== undefined) args.push(data);

    console[level](...args);
  }

  return {
    debug: (msg, data) => _log('debug', msg, data),
    info:  (msg, data) => _log('info',  msg, data),
    warn:  (msg, data) => _log('warn',  msg, data),
    error: (msg, data) => _log('error', msg, data),
  };
}
