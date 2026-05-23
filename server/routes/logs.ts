import { Hono } from 'hono';
import { LogRotator } from '../../src/utils/log-rotator';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = '.agent/log-config.json';

function getLogRotator(): LogRotator {
  return (globalThis as any).__logRotator ?? new LogRotator();
}

function getLevel(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw).level || 'info';
    }
  } catch {}
  return 'info';
}

function setLevel(level: string): void {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ level, updatedAt: new Date().toISOString() }, null, 2));
}

const logs = new Hono();

logs.get('/level', (c) => {
  return c.json({ level: getLevel() });
});

logs.put('/level', async (c) => {
  const { level } = await c.req.json();
  const valid = ['debug', 'info', 'warn', 'error'];
  if (!valid.includes(level)) {
    return c.json({ error: `Invalid level. Must be one of: ${valid.join(', ')}` }, 400);
  }
  setLevel(level);
  return c.json({ level, updatedAt: new Date().toISOString() });
});

logs.get('/files', (c) => {
  const rotator = getLogRotator();
  const files = rotator.listLogFiles();
  return c.json(files);
});

logs.get('/query', (c) => {
  const filename = c.req.query('file');
  const level = c.req.query('level');
  const keyword = c.req.query('keyword');
  const startTime = c.req.query('startTime');
  const endTime = c.req.query('endTime');
  const page = parseInt(c.req.query('page') || '1', 10);
  const pageSize = parseInt(c.req.query('pageSize') || '50', 10);

  const rotator = getLogRotator();
  const targetFile = filename || rotator.getCurrentLogPath().split('/').pop()!;
  const result = rotator.readLogFile(targetFile, { level, keyword, startTime, endTime, page, pageSize });
  return c.json(result);
});

logs.get('/audit', (c) => {
  const sessionId = c.req.query('sessionId');
  const action = c.req.query('action');
  const toolName = c.req.query('toolName');
  const status = c.req.query('status');
  const keyword = c.req.query('keyword');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const auditPath = '.agent/audit.jsonl';

  if (!fs.existsSync(auditPath)) {
    return c.json({ items: [], total: 0 });
  }

  const items = fs.readFileSync(auditPath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry: any) => !sessionId || entry.sessionId === sessionId)
    .filter((entry: any) => !action || entry.action === action)
    .filter((entry: any) => !toolName || entry.toolName === toolName)
    .filter((entry: any) => !status || entry.status === status)
    .filter((entry: any) => {
      if (!keyword) return true;
      const haystack = JSON.stringify(entry).toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    })
    .slice(-limit)
    .reverse();

  return c.json({
    items,
    total: items.length,
  });
});

logs.get('/audit/timeline', (c) => {
  const sessionId = c.req.query('sessionId');
  const auditPath = '.agent/audit.jsonl';

  if (!sessionId) {
    return c.json({ error: 'sessionId is required' }, 400);
  }
  if (!fs.existsSync(auditPath)) {
    return c.json({ items: [], total: 0, summary: { allowed: 0, denied: 0, errors: 0 } });
  }

  const entries = fs.readFileSync(auditPath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry: any) => entry.sessionId === sessionId)
    .sort((a: any, b: any) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  const items = entries.map((entry: any) => ({
    timestamp: entry.timestamp,
    kind: entry.category === 'timeline'
      ? entry.eventType
      : entry.toolName
        ? 'tool'
        : entry.action || 'event',
    action: entry.action,
    status: entry.status,
    toolName: entry.toolName,
    summary: entry.summary || entry.reason || entry.output || entry.filePath || '',
    filePath: entry.filePath,
    raw: entry,
  }));

  return c.json({
    items,
    total: items.length,
    summary: {
      allowed: entries.filter((entry: any) => entry.action === 'allowed').length,
      denied: entries.filter((entry: any) => entry.action === 'denied').length,
      errors: entries.filter((entry: any) => entry.status === 'error').length,
    },
  });
});

export { logs };
