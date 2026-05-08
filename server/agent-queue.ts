// server/agent-queue.ts
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createAgent } from './routes/chat';

const connection = new Redis();

export const agentQueue = new Queue('agent-tasks', { connection });
export const resultCache = new Map<string, string>(); // 简单结果缓存

// Worker 池：并发 4 个，根据 CPU 调整
new Worker('agent-tasks', async (job) => {
  const { sessionId, input, config } = job.data;
  const agent = await createAgent(sessionId, config);
  const result = await agent.run(input);
  resultCache.set(job.id!, result);
  return result;
}, { connection, concurrency: 4 });