// 将以下端点合并到你的 server/api.ts 中

import { ApiKeyStore } from '../src/security/key-store';
import { logBus } from '../src/observability/log-bus';

export function registerAdditionalRoutes(app: any) {
  // ========== API Key 管理 ==========
  const keyStore = new ApiKeyStore('.agent/apikeys.db');
  app.get('/api/keys', (c: any) => c.json(keyStore.list()));
  app.post('/api/keys', async (c: any) => {
    const { name, plainKey } = await c.req.json();
    if (!plainKey) return c.json({ error: '缺少 plainKey' }, 400);
    const record = await keyStore.store(name, plainKey);
    return c.json({ id: record.id, name: record.name, masked: record.masked });
  });
  app.delete('/api/keys/:id', (c: any) => { keyStore.delete(c.req.param('id')); return c.json({ success: true }); });

  // ========== 实时日志流 ==========
  app.get('/api/logs/stream', (c: any) => {
    const stream = new ReadableStream({
      start(controller: any) {
        const handler = (entry: any) => {
          try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(entry)}\n\n`)); } catch {}
        };
        logBus.on('log', handler);
        c.req.raw.signal.addEventListener('abort', () => { logBus.off('log', handler); try { controller.close(); } catch {} });
      },
    });
    return c.newResponse(stream, { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  });
}
