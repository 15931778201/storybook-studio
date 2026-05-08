import { Hono } from 'hono';
import { agentQueue, resultCache } from '../agent-queue';

const agent = new Hono();
agent.post('/async', async (c) => {
  const body = await c.req.json();
  const job = await agentQueue.add('agent-task', body);
  return c.json({ jobId: job.id });
});

agent.get('/result/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const result = resultCache.get(jobId);
  if (result) return c.json({ result });
  return c.json({ status: 'pending' }, 202);
});

export { agent };