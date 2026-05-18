import fs from 'fs';
import { Hono } from 'hono';
import { AgentEventBus } from '../../src/core/events';
import { AgentLoop } from '../../src/core/agent-loop';
import {
  ApplyPatchTool,
  BashTool,
  CreateSkillTool,
  DiffUndoPolicy,
  EditFileTool,
  FileMemory,
  GitTool,
  GlobTool,
  GrepTool,
  JsonQueryTool,
  ListSkillsTool,
  ReadFileTool,
  RepoMapTool,
  SkillCallerTool,
  SlidingWindowContextManager,
  WriteFileTool,
} from '../../src';
import { changelogStore, knowledgeBaseManager, mcpClient, modelConfigStore, roleStore, skillManager } from '../context';

const chat = new Hono();
const eventBus = AgentEventBus.getInstance();

export function buildChatTools(workspaceRoot = '.') {
  const baseTools = [
    new ReadFileTool({ workspaceRoot }),
    new WriteFileTool({ workspaceRoot }),
    new BashTool({ workspaceRoot }),
    new GrepTool({ workspaceRoot }),
    new GlobTool({ workspaceRoot }),
    new EditFileTool({ workspaceRoot }),
    new ApplyPatchTool({ workspaceRoot }),
    new JsonQueryTool({ workspaceRoot }),
    new GitTool({ workspaceRoot }),
    new RepoMapTool({ workspaceRoot }),
  ];

  return [
    ...baseTools,
    new SkillCallerTool(skillManager, [...baseTools]),
    new ListSkillsTool(skillManager),
    new CreateSkillTool(skillManager),
  ];
}

export function createAgent(sessionId: string, options: {
  workspaceRoot?: string;
  kbIds?: string[];
  roleId?: string;
  imageRef?: string;
} = {}) {
  const stored = modelConfigStore.get() || {} as any;
  const workspaceRoot = options.workspaceRoot || '.';
  const kbIds = options.kbIds || [];
  const roleProfile = options.roleId ? roleStore.get(options.roleId) || null : null;

  const config: any = {
    model: stored.model || process.env.OPENAI_MODEL || 'gpt-4o',
    baseURL: stored.baseURL || process.env.OPENAI_BASE_URL || undefined,
    apiKey: stored.apiKey || process.env.OPENAI_API_KEY || '',
    temperature: stored.temperature ?? 0.7,
    maxTokens: stored.maxTokens ?? 8192,
    tools: buildChatTools(workspaceRoot),
    memory: new FileMemory({ path: `.agent/${sessionId}_memory.json` }),
    contextMgr: new SlidingWindowContextManager({
      maxTokens: (stored.maxTokens ?? 8192) * 2,
      keepRecentTurns: 6,
      compressionThreshold: 0.9,
    }),
    policy: new DiffUndoPolicy({
      backupDir: '.agent/backups',
      autoConfirm: false,
      workspaceRoot,
    }),
    maxIterations: 15,
    skillManager,
    knowledgeBase: kbIds.length > 0
      ? { retrieve: (query: string, topK: number) => knowledgeBaseManager.retrieve(query, kbIds, topK) }
      : null,
    mcpClient,
    modelConfigStore,
    roleProfile,
  };

  if (options.imageRef && fs.existsSync(options.imageRef)) {
    config.imageBase64 = fs.readFileSync(options.imageRef).toString('base64');
  }

  return new AgentLoop(config, sessionId);
}

chat.get('/stream/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const userInput = c.req.query('input');
  if (!userInput) return c.text('Missing input', 400);

  const kbIds = c.req.query('kbIds')?.split(',').filter(Boolean) || [];
  const workspaceRoot = c.req.query('projectPath') || '.';
  const roleId = c.req.query('roleId') || undefined;
  const imageRef = c.req.query('imageRef') || undefined;
  const agent = createAgent(sessionId, { workspaceRoot, kbIds, roleId, imageRef });

  let streamClosed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        if (streamClosed) return;
        try {
          const bytes = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
          controller.enqueue(bytes);
        } catch {}
      };

      const confirmHandler = (req: any) => {
        if (req.sessionId === sessionId) send({ type: 'confirm', ...req });
      };
      const msgHandler = (data: any) => send(data);

      eventBus.on('confirm-request', confirmHandler);
      eventBus.on(`message-${sessionId}`, msgHandler);

      agent.run(userInput)
        .then((final: string) => {
          send({ type: 'final', content: final });
          if (final && final.length > 10 && !final.startsWith('⚠️')) {
            const type = /修复|bug|fix|hotfix|漏洞/.test(userInput) ? 'bug'
              : /优化|refactor|重构|提升|perf/.test(userInput) ? 'optimization'
              : 'requirement';
            changelogStore?.create({
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

chat.post('/confirm', async (c) => {
  const { sessionId, approved, selectedFiles } = await c.req.json();
  eventBus.emit('confirm-response', { sessionId, approved, selectedFiles });
  return c.json({ ok: true });
});

export { chat };
