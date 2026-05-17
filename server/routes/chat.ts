// // server/routes/chat.ts
// import { Hono } from 'hono';
// import { AgentEventBus } from '../../src/core/events';
// import { AgentLoop } from '../../src/core/agent-loop';
// import {
//   FileMemory, SlidingWindowContextManager, DiffUndoPolicy,
//   ReadFileTool, WriteFileTool, BashTool, GrepTool,
//   SkillCallerTool, ListSkillsTool, CreateSkillTool,
// } from '../../src';
// import { sessions, skillManager, modelConfigStore, knowledgeBase, mcpClient } from '../context';
// import { ApiKeyStore } from '../../src/security/key-store';

// const chat = new Hono();
// const eventBus = AgentEventBus.getInstance();
// const agentSessions = new Map<string, AgentLoop>();
// const keyStore = new ApiKeyStore();
//   const baseTools = [
//     new ReadFileTool(),
//     new WriteFileTool(),
//     new BashTool(),
//     new GrepTool(),
//   ];

//   const skillTools = [
//     new SkillCallerTool(skillManager, [...baseTools]),
//     new ListSkillsTool(skillManager),
//     new CreateSkillTool(skillManager),
//   ];

// function getOrCreateAgent(sessionId: string, config: any) {
//   if (!agentSessions.has(sessionId)) {
//     const agent = new AgentLoop(config, sessionId);
//     agentSessions.set(sessionId, agent);
//   }
//   return agentSessions.get(sessionId)!;
// }

// export function createAgent(sessionId: string, queryParams: any = {}) {
//   const model = queryParams('model') || process.env.OPENAI_MODEL || 'gpt-4o';
//   const baseURL = queryParams('baseURL') || process.env.OPENAI_BASE_URL;
//   const temperature = parseFloat(queryParams('temperature') || '0.7');
//   const maxTokens = parseInt(queryParams('maxTokens') || '8000');  
//   const hasImage = queryParams('image') === 'true';
//   const apiKeyDefault = modelConfigStore.apiKey
//     ? keyStore.getDecrypted(modelConfigStore.apiKeyId)    // 从 KeyStore 解密
//     : process.env.OPENAI_API_KEY;                     // 回退环境变量
//   let apiKey = queryParams('apiKey') ? queryParams('apiKey')  : apiKeyDefault;
//   const config: any = {
//     model, // 动态配置会覆盖
//     baseURL,
//     temperature,
//     maxTokens,
//     apiKey,
//     tools: [...baseTools, ...skillTools],
//     supportsVision: hasImage,
//     memory: new FileMemory({ path: `.agent/${sessionId}_memory.json` }),
//     contextMgr: new SlidingWindowContextManager({ maxTokens, keepRecentTurns: 6, compressionThreshold: 0.9 }),
//     policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }),
//     maxIterations: 15,
//     skillManager,
//     knowledgeBase,
//     mcpClient,
//   };

//   const agent = new AgentLoop(config, sessionId, modelConfigStore);
//   sessions.set(sessionId, agent);
//   return agent;
// }

// chat.get('/stream/:sessionId', async (c) => {
//   const sessionId = c.req.param('sessionId');
//   const userInput = c.req.query('input');
//   if (!userInput) return c.text('Missing input', 400);

//   const agent = createAgent(sessionId, c.req.query);
//   let streamClosed = false;

//   const stream = new ReadableStream({
//     start(controller) {
//       const send = (data: any) => {
//         if (!streamClosed) {
//           try {
//             const bytes = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
//             controller.enqueue(bytes);
//           } catch {}
//         }
//       };

//       const confirmHandler = (req: any) => send({ type: 'confirm', ...req });
//       eventBus.on('confirm-request', confirmHandler);

//       const msgHandler = (data: any) => send(data);
//       eventBus.on(`message-${sessionId}`, msgHandler);

//       agent.run(userInput)
//         .then((final: string) => send({ type: 'final', content: final }))
//         .catch((err: Error) => send({ type: 'error', content: err.message }))
//         .finally(() => {
//           eventBus.off('confirm-request', confirmHandler);
//           eventBus.off(`message-${sessionId}`, msgHandler);
//           streamClosed = true;
//           try { controller.close(); } catch {}
//         });
//     },
//   });

//   return c.newResponse(stream, {
//     headers: {
//       'Content-Type': 'text/event-stream; charset=UTF-8',
//       'Cache-Control': 'no-cache',
//       Connection: 'keep-alive',
//     },
//   });
// });

// chat.post('/confirm', async (c) => {
//   const { sessionId, approved } = await c.req.json();
//   eventBus.emit('confirm-response', { sessionId, approved });
//   return c.json({ ok: true });
// });

// export { chat };

// server/routes/chat.ts
import { Hono } from 'hono';
import { AgentEventBus } from '../../src/core/events';
import { AgentLoop } from '../../src/core/agent-loop';
import {
  FileMemory, SlidingWindowContextManager, DiffUndoPolicy,
  ReadFileTool, WriteFileTool, BashTool, GrepTool,
  SkillCallerTool, ListSkillsTool, CreateSkillTool,
} from '../../src';
import { skillManager, modelConfigStore, knowledgeBaseManager, mcpClient, roleStore, changelogStore } from '../context';
import fs from 'fs';

const chat = new Hono();
const eventBus = AgentEventBus.getInstance();
const agentSessions = new Map<string, AgentLoop>();

// 基础工具
const baseTools = [
  new ReadFileTool(),
  new WriteFileTool(),
  new BashTool(),
  new GrepTool(),
];

// 技能工具（依赖 baseTools）
const skillTools = [
  new SkillCallerTool(skillManager, [...baseTools]),
  new ListSkillsTool(skillManager),
  new CreateSkillTool(skillManager),
];

// 合并全部工具
const allTools = [...baseTools, ...skillTools];

export function createAgent(sessionId: string, config: any): AgentLoop {
  if (!agentSessions.has(sessionId)) {
    const agent = new AgentLoop(config, sessionId);
    agentSessions.set(sessionId, agent);
  }
  return agentSessions.get(sessionId)!;
}

function buildAgentConfig(sessionId: string, kbIds: string[] = [], roleId?: string): any {
  const stored = modelConfigStore.get() || {} as any;

  let roleProfile = null;
  if (roleId) {
    roleProfile = roleStore.get(roleId) || null;
  }

  return {
    model: stored.model || process.env.OPENAI_MODEL || 'gpt-4o',
    baseURL: stored.baseURL || process.env.OPENAI_BASE_URL || undefined,
    apiKey: stored.apiKey || process.env.OPENAI_API_KEY || '',
    temperature: stored.temperature ?? 0.7,
    maxTokens: stored.maxTokens ?? 8192,
    tools: allTools,
    memory: new FileMemory({ path: `.agent/${sessionId}_memory.json` }),
    contextMgr: new SlidingWindowContextManager({
      maxTokens: (stored.maxTokens ?? 8192) * 2,
      keepRecentTurns: 6,
      compressionThreshold: 0.9,
    }),
    policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }),
    maxIterations: 15,
    skillManager,
    knowledgeBase: kbIds.length > 0
      ? { retrieve: (query: string, topK: number) => knowledgeBaseManager.retrieve(query, kbIds, topK) }
      : null,
    mcpClient,
    modelConfigStore,
    roleProfile,
  };
}

// SSE 流式端点
chat.get('/stream/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const userInput = c.req.query('input');
  if (!userInput) return c.text('Missing input', 400);

  const kbIds = c.req.query('kbIds')?.split(',').filter(Boolean) || [];
  const roleId = c.req.query('roleId') || undefined;
  const config = buildAgentConfig(sessionId, kbIds, roleId);

  // 图片引用：从临时文件读取 base64
  const imageRef = c.req.query('imageRef');
  if (imageRef) {
    try {
      if (fs.existsSync(imageRef)) {
        const imageBuffer = fs.readFileSync(imageRef);
        (config as any).imageBase64 = imageBuffer.toString('base64');
      }
    } catch (e) {
      console.error('读取图片失败:', e);
    }
  }

  const agent = createAgent(sessionId, config);

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

      const confirmHandler = (req: any) => {
        if (req.sessionId === sessionId) {
          send({ type: 'confirm', ...req });
        }
      };
      eventBus.on('confirm-request', confirmHandler);

      const msgHandler = (data: any) => send(data);
      eventBus.on(`message-${sessionId}`, msgHandler);

      agent.run(userInput)
        .then((final: string) => {
          send({ type: 'final', content: final });
          if (final && final.length > 10 && !final.startsWith('⚠️')) {
            const type = /修复|bug|fix|hotfix|漏洞/.test(userInput) ? 'bug'
              : /优化|refactor|重构|提升|perf/.test(userInput) ? 'optimization'
              : 'requirement';
            changelogStore.create({
              type,
              title: userInput.slice(0, 80),
              description: final.slice(0, 200),
              trigger: 'agent',
            }).catch(() => {});
          }
        })
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

// 确认端点
chat.post('/confirm', async (c) => {
  const { sessionId, approved } = await c.req.json();
  eventBus.emit('confirm-response', { sessionId, approved });
  return c.json({ ok: true });
});

export { chat };