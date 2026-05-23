import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import app from '../server/api';

const originalToken = process.env.API_SECRET_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.API_SECRET_TOKEN;
  } else {
    process.env.API_SECRET_TOKEN = originalToken;
  }
});

function request(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

describe('plan control and audit api', () => {
  it('stores and returns plan control state for a session', async () => {
    delete process.env.API_SECRET_TOKEN;

    const update = await request('/api/agents/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', action: 'pause', stepId: 2 }),
    });

    expect(update.status).toBe(200);

    const query = await request('/api/agents/control/session-1');
    expect(query.status).toBe(200);

    const payload = await query.json();
    expect(payload.action).toBe('pause');
    expect(payload.stepId).toBe(2);
  });

  it('returns audit records from audit jsonl with session and action filters', async () => {
    delete process.env.API_SECRET_TOKEN;
    fs.mkdirSync('.agent', { recursive: true });
    fs.writeFileSync('.agent/audit.jsonl', [
      JSON.stringify({ sessionId: 's1', action: 'apply', toolName: 'apply_patch', filePath: 'a.ts' }),
      JSON.stringify({ sessionId: 's2', action: 'rollback', toolName: 'apply_patch', filePath: 'b.ts' }),
    ].join('\n') + '\n', 'utf-8');

    const response = await request('/api/logs/audit?sessionId=s1&action=apply');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].filePath).toBe('a.ts');
  });

  it('supports audit keyword and status filters for independent audit views', async () => {
    delete process.env.API_SECRET_TOKEN;
    fs.mkdirSync('.agent', { recursive: true });
    fs.writeFileSync('.agent/audit.jsonl', [
      JSON.stringify({ sessionId: 's1', action: 'allowed', status: 'done', toolName: 'apply_patch', reason: 'updated src/a.ts', filePath: 'src/a.ts' }),
      JSON.stringify({ sessionId: 's1', action: 'denied', status: 'denied', toolName: 'bash', reason: 'rm blocked', filePath: 'src/b.ts' }),
    ].join('\n') + '\n', 'utf-8');

    const response = await request('/api/logs/audit?sessionId=s1&status=denied&keyword=blocked');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].toolName).toBe('bash');
  });

  it('returns ordered timeline events for a session replay view', async () => {
    delete process.env.API_SECRET_TOKEN;
    fs.mkdirSync('.agent', { recursive: true });
    fs.writeFileSync('.agent/audit.jsonl', [
      JSON.stringify({ sessionId: 'timeline-1', category: 'timeline', eventType: 'user-input', summary: 'fix tests', timestamp: '2026-05-20T10:00:00.000Z' }),
      JSON.stringify({ sessionId: 'timeline-1', category: 'timeline', eventType: 'plan', summary: '2 steps', stepId: 1, timestamp: '2026-05-20T10:00:01.000Z' }),
      JSON.stringify({ sessionId: 'timeline-1', action: 'allowed', status: 'done', toolName: 'apply_patch', reason: 'updated src/a.ts', filePath: 'src/a.ts', timestamp: '2026-05-20T10:00:02.000Z' }),
      JSON.stringify({ sessionId: 'timeline-1', category: 'timeline', eventType: 'test-result', summary: 'bun test passed', timestamp: '2026-05-20T10:00:03.000Z' }),
    ].join('\n') + '\n', 'utf-8');

    const response = await request('/api/logs/audit/timeline?sessionId=timeline-1');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(4);
    expect(payload.items[0].kind).toBe('user-input');
    expect(payload.items[2].kind).toBe('tool');
    expect(payload.summary.allowed).toBe(1);
  });
});
