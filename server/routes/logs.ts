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

export { logs };
