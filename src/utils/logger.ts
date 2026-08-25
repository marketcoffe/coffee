/**
 * ═══ LOGGER CENTRALIZADO ═══
 * Sistema de logging estructurado con etiquetas por módulo/componente.
 * Reemplaza console.error/console.log sueltos con logs consistentes.
 *
 * Uso:
 *   import { log } from '@/utils/logger';
 *   log.error('Supabase', 'Query failed', { table: 'orders', error });
 *   log.warn('Push', 'Subscription expired');
 *   log.info('Auth', 'User signed in', { email });
 *   log.debug('Cart', 'Item added', { productId });
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

const LOG_HISTORY: LogEntry[] = [];
const MAX_HISTORY = 200;

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function addEntry(level: LogLevel, module: string, message: string, data?: unknown): void {
  const entry: LogEntry = { timestamp: formatTimestamp(), level, module, message, data };
  LOG_HISTORY.push(entry);
  if (LOG_HISTORY.length > MAX_HISTORY) LOG_HISTORY.shift();
}

function formatConsole(level: LogLevel, module: string, message: string, data?: unknown): string {
  const ts = formatTimestamp().slice(11, 23);
  const prefix = `[${ts}] [${level.toUpperCase()}] [${module}]`;
  return `${prefix} ${message}`;
}

export const log = {
  error(module: string, message: string, data?: unknown): void {
    addEntry('error', module, message, data);
    if (data !== undefined) {
      console.error(formatConsole('error', module, message), data);
    } else {
      console.error(formatConsole('error', module, message));
    }
  },

  warn(module: string, message: string, data?: unknown): void {
    addEntry('warn', module, message, data);
    if (data !== undefined) {
      console.warn(formatConsole('warn', module, message), data);
    } else {
      console.warn(formatConsole('warn', module, message));
    }
  },

  info(module: string, message: string, data?: unknown): void {
    addEntry('info', module, message, data);
    if (data !== undefined) {
      console.log(formatConsole('info', module, message), data);
    } else {
      console.log(formatConsole('info', module, message));
    }
  },

  debug(module: string, message: string, data?: unknown): void {
    addEntry('debug', module, message, data);
    if (data !== undefined) {
      console.debug(formatConsole('debug', module, message), data);
    } else {
      console.debug(formatConsole('debug', module, message));
    }
  },

  /** Retorna el historial completo de logs (para debug panel) */
  getHistory(): readonly LogEntry[] {
    return LOG_HISTORY;
  },

  /** Retorna solo los errores */
  getErrors(): readonly LogEntry[] {
    return LOG_HISTORY.filter(e => e.level === 'error');
  },

  /** Limpia el historial */
  clear(): void {
    LOG_HISTORY.length = 0;
  },
};
