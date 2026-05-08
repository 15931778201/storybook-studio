import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { AgentLoop } from '../core/agent-loop';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const agentQueue = new Queue('agent-tasks', { connection });
export const resultCache = new Map<string, string>(); // 简单结果缓存

// Worker 处理任务
const worker = new Worker('agent-tasks', async (job: Job) => {
  const { sessionId, input, config: agentConfig } = job.data;
  const agent = new AgentLoop(agentConfig, sessionId);
  const result = await agent.run(input);
  return result;
}, { connection, concurrency: 4 });

worker.on('completed', async (job: Job) => {
  // Webhook 回调
  const webhookUrl = job.data.webhook;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, result: job.returnvalue }),
    });
  }
});