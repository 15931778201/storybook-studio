import { Hono } from 'hono';

const agent = new Hono();

// 启动时调用
agent.post('/async', async (c) => {
  const body = await c.req.json();
  // 检查是否需要 Redis
  if (!process.env.REDIS_HOST) {
    return c.json({ error: 'Redis 未配置，异步任务不可用' }, 503);
  }  
  try {
    const { agentQueue } = await import('../../src/queue/agent-queue');
    const job = await agentQueue.add('agent-task', {
      sessionId: body.sessionId,
      input: body.input,
      config: body.config,
      webhook: body.webhook,
    });
    return c.json({ jobId: job.id });
  } catch (e: any) {
    return c.json({ error: `队列错误: ${e.message}` }, 500);
  }
});

agent.get('/result/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!process.env.REDIS_HOST) {
    return c.json({ error: 'Redis 未配置' }, 503);
  }  
  try {
    const { resultCache } = await import('../../src/queue/agent-queue');
    const result = resultCache.get(jobId);
    if (result) return c.json({ result });
    return c.json({ status: 'pending' }, 202);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export { agent };