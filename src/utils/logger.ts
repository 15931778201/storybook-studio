import fs from 'fs';
import { logBus } from '../observability/log-bus';
import { LogRotator } from './log-rotator';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  sessionId?: string;
  duration?: number;
  tokensUsed?: number;
  toolName?: string;
  [key: string]: any;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const CONFIG_PATH = '.agent/log-config.json';
const LOG_DIR = '.agent/logs';

let rotator: LogRotator | null = null;

function getRotator(): LogRotator {
  if (!rotator) rotator = new LogRotator(LOG_DIR);
  return rotator;
}

function getConfiguredLevel(): LogLevel {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const level = JSON.parse(raw).level;
      if (['debug', 'info', 'warn', 'error'].includes(level)) return level;
    }
  } catch {}
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

const SENSITIVE_KEYS = ['apiKey', 'token', 'password'];

function sanitize(entry: Record<string, any>) {
  for (const key of SENSITIVE_KEYS) {
    if (entry[key]) entry[key] = '***';
  }
  return entry;
}

export function structuredLog(entry: Omit<LogEntry, 'timestamp'>) {
  if (!shouldLog(entry.level || 'info')) return;

  const final: LogEntry = {
    level: entry.level || 'info',
    message: entry.message,
    timestamp: new Date().toISOString(),
    ...sanitize(entry as any),
  };

  const str = JSON.stringify(final);
  switch (entry.level) {
    case 'error': console.error(str); break;
    case 'warn': console.warn(str); break;
    default: console.log(str);
  }

  logBus.emit('log', final);

  try {
    getRotator().append(str);
  } catch {}
}

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'info', message: msg, ...meta }),
  warn: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'warn', message: msg, ...meta }),
  error: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'error', message: msg, ...meta }),
  debug: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'debug', message: msg, ...meta }),
};

export function appendAuditLog(entry: any, logPath = '.agent/audit.jsonl') {
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

export { LogRotator };
