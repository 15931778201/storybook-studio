
import fs from 'fs';
import { logBus } from '../observability/log-bus';

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

const SENSITIVE_KEYS = ['apiKey', 'token', 'password'];

function sanitize(entry: Record<string, any>) {
  for (const key of SENSITIVE_KEYS) {
    if (entry[key]) entry[key] = '***';
  }
  return entry;
}

export function structuredLog(entry: Omit<LogEntry, 'timestamp'>) {
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
  // 推送到全局日志总线
  logBus.emit('log', final);
}

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'info', message: msg, ...meta }),
  warn: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'warn', message: msg, ...meta }),
  error: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'error', message: msg, ...meta }),
  debug: (msg: string, meta?: Record<string, any>) => structuredLog({ level: 'debug', message: msg, ...meta }),
};

export function appendAuditLog(entry: any, logPath = '.agent/audit.jsonl') { fs.appendFileSync(logPath, JSON.stringify(entry) + '\n'); }
