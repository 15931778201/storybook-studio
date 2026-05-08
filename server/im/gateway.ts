import { Hono } from 'hono';
import type { IMAdapter } from '../../src/im/adapter';
import { AgentLoop } from '../../src/core/agent-loop';
import { createAgent } from '../routes/chat';
// ... 导入 Agent 配置
import { modelConfigStore } from '../context';

const imRouter = new Hono();
const adapters = new Map<string, IMAdapter>();

// 注册适配器（在 server 启动时调用）
export function registerAdapter(name: string, adapter: IMAdapter) {
  adapters.set(name, adapter);
}

// 通用接收端点
imRouter.post('/webhook/:platform', async (c) => {
  const platform = c.req.param('platform');
  const adapter = adapters.get(platform);
  if (!adapter) return c.text('Unknown platform', 404);

  const rawBody = await c.req.text();
  const headers = Object.fromEntries(c.req.raw.headers.entries());

  // 签名验证
  if (!adapter.verifySignature(rawBody, headers)) {
    return c.text('Signature verification failed', 403);
  }

  // 解析消息
  const message = adapter.parseMessage(rawBody);

  // 调用 Agent
  const agent = createAgent(message.userId, modelConfigStore); // 复用你现有的 createAgent
  const reply = await agent.run(message.content);

  // 发送回复
  await adapter.sendMessage(message, { text: reply });

  return c.text('OK');
});

export { imRouter };