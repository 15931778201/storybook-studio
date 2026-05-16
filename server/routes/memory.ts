// server/routes/memory.ts
import { Hono } from 'hono';
import { knowledgeBaseManager } from '../context';

const memory = new Hono();

memory.post('/extract', async (c) => {
  const { sessionId, messages } = await c.req.json();
  // 这里可以调用 extractMemories 函数（之前 src/memory/extractor.ts）
  // 为简单起见，返回示例：
  return c.json({ extracted: [] });
});

export { memory };