// server/routes/chat.ts
import { Hono } from 'hono';
import { AgentEventBus } from '../../src/core/events';
import { AgentLoop } from '../../src/core/agent-loop';
import {
  FileMemory, SlidingWindowContextManager, DiffUndoPolicy,
  ReadFileTool, WriteFileTool, BashTool, GrepTool,
  SkillCallerTool, ListSkillsTool, CreateSkillTool,
} from '../../src';
import { sessions, skillManager, modelConfigStore, knowledgeBase, mcpClient } from '../context';
import { ApiKeyStore } from '../../src/security/key-store';

const chat = new Hono();
const eventBus = AgentEventBus.getInstance();
const agentSessions = new Map<string, AgentLoop>();
const keyStore = new ApiKeyStore();
  const baseTools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new BashTool(),
    new GrepTool(),
  ];

  const skillTools = [
    new SkillCallerTool(skillManager, [...baseTools]),
    new ListSkillsTool(skillManager),
    new CreateSkillTool(skillManager),
  ];

function getOrCreateAgent(sessionId: string, config: any) {
  if (!agentSessions.has(sessionId)) {
    const agent = new AgentLoop(config, sessionId);
    agentSessions.set(sessionId, agent);
  }
  return agentSessions.get(sessionId)!;
}

export function createAgent(sessionId: string, queryParams: any = {}) {
  const model = queryParams('model') || process.env.OPENAI_MODEL || 'gpt-4o';
  const baseURL = queryParams('baseURL') || process.env.OPENAI_BASE_URL;
  const temperature = parseFloat(queryParams('temperature') || '0.7');
  const maxTokens = parseInt(queryParams('maxTokens') || '8000');  
  const hasImage = queryParams('image') === 'true';
  const apiKeyDefault = modelConfigStore.apiKey
    ? keyStore.getDecrypted(modelConfigStore.apiKeyId)    // 从 KeyStore 解密
    : process.env.OPENAI_API_KEY;                     // 回退环境变量
  let apiKey = queryParams('apiKey') ? queryParams('apiKey')  : apiKeyDefault;
  const config: any = {
    model, // 动态配置会覆盖
    baseURL,
    temperature,
    maxTokens,
    apiKey,
    tools: [...baseTools, ...skillTools],
    supportsVision: hasImage,
    memory: new FileMemory({ path: `.agent/${sessionId}_memory.json` }),
    contextMgr: new SlidingWindowContextManager({ maxTokens, keepRecentTurns: 6, compressionThreshold: 0.9 }),
    policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }),
    maxIterations: 15,
    skillManager,
    knowledgeBase,
    mcpClient,
  };

  const agent = new AgentLoop(config, sessionId, modelConfigStore);
  sessions.set(sessionId, agent);
  return agent;
}

chat.get('/stream/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const userInput = c.req.query('input');
  if (!userInput) return c.text('Missing input', 400);

  const agent = createAgent(sessionId, c.req.query);
  let streamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        if (!streamClosed) {
          try {
            const bytes = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
            controller.enqueue(bytes);
          } catch {}
        }
      };

      const confirmHandler = (req: any) => send({ type: 'confirm', ...req });
      eventBus.on('confirm-request', confirmHandler);

      const msgHandler = (data: any) => send(data);
      eventBus.on(`message-${sessionId}`, msgHandler);

      agent.run(userInput)
        .then((final: string) => send({ type: 'final', content: final }))
        .catch((err: Error) => send({ type: 'error', content: err.message }))
        .finally(() => {
          eventBus.off('confirm-request', confirmHandler);
          eventBus.off(`message-${sessionId}`, msgHandler);
          streamClosed = true;
          try { controller.close(); } catch {}
        });
    },
  });

  return c.newResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=UTF-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

chat.post('/confirm', async (c) => {
  const { sessionId, approved } = await c.req.json();
  eventBus.emit('confirm-response', { sessionId, approved });
  return c.json({ ok: true });
});

export { chat };