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
  FileTreeSummaryTool,
  FileMemory,
  GitTool,
  GitContextTool,
  GlobTool,
  GrepTool,
  JsonQueryTool,
  ListSkillsTool,
  ReadFileTool,
  RepoMapTool,
  SkillCallerTool,
  SlidingWindowContextManager,
  TsSymbolsTool,
  WriteFileTool,
} from '../../src';
import { changelogStore, knowledgeBaseManager, mcpClient, modelConfigStore, roleStore, skillManager } from '../context';
import { loadRuntimeSnapshot, saveRuntimeSnapshot } from '../../src/storage/session-runtime-store';
import { appendAuditLog } from '../../src/utils/logger';

const chat = new Hono();
const eventBus = AgentEventBus.getInstance();
const sessionRuntime = new Map<string, {
  agent: AgentLoop;
  abortController: AbortController | null;
  lastInput: string;
  running: boolean;
}>();

function appendTimelineEvent(sessionId: string, eventType: string, payload: Record<string, any> = {}) {
  appendAuditLog({
    sessionId,
    category: 'timeline',
    eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

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
    new FileTreeSummaryTool({ workspaceRoot }),
    new GitContextTool({ workspaceRoot }),
    new TsSymbolsTool({ workspaceRoot }),
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
  appendTimelineEvent(sessionId, 'user-input', { summary: userInput, workspaceRoot, roleId });
  const agent = createAgent(sessionId, { workspaceRoot, kbIds, roleId, imageRef });
  const runtimeSnapshot = loadRuntimeSnapshot(sessionId);
  sessionRuntime.set(sessionId, {
    agent,
    abortController: new AbortController(),
    lastInput: runtimeSnapshot?.lastInput || userInput,
    running: true,
  });

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
        if (req.sessionId === sessionId) {
          appendTimelineEvent(sessionId, 'confirm-request', {
            toolName: req.toolName,
            summary: req.summary ? JSON.stringify(req.summary) : req.toolName,
          });
          send({ type: 'confirm', ...req });
        }
      };
      const msgHandler = (data: any) => {
        appendTimelineEvent(sessionId, data.type || 'message', {
          toolName: data.toolName,
          stepId: data.stepId,
          status: data.status,
          summary: typeof data.content === 'string'
            ? data.content.slice(0, 200)
            : data.summary || data.resultSummary || data.command || '',
        });
        send(data);
      };

      eventBus.on('confirm-request', confirmHandler);
      eventBus.on(`message-${sessionId}`, msgHandler);

      agent.run(userInput, sessionRuntime.get(sessionId)?.abortController?.signal, { resume: false })
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
          const runtime = sessionRuntime.get(sessionId);
          if (runtime) {
            runtime.running = false;
            runtime.abortController = null;
          }
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
  appendTimelineEvent(sessionId, 'confirm-response', {
    status: approved ? 'approved' : 'rejected',
    summary: approved ? '用户已确认' : '用户已拒绝',
    selectedFiles,
  });
  eventBus.emit('confirm-response', { sessionId, approved, selectedFiles });
  return c.json({ ok: true });
});

chat.post('/sessions/:sessionId/stop', async (c) => {
  const sessionId = c.req.param('sessionId');
  const runtime = sessionRuntime.get(sessionId);
  if (!runtime || !runtime.running || !runtime.abortController) {
    return c.json({ ok: false, error: 'session not running' }, 404);
  }
  runtime.abortController.abort();
  runtime.running = false;
  appendTimelineEvent(sessionId, 'session-stop', { status: 'paused', summary: '用户停止当前运行' });
  const snapshot = loadRuntimeSnapshot(sessionId);
  if (snapshot) {
    saveRuntimeSnapshot({ ...snapshot, status: 'paused', phase: 'aborted' });
  }
  return c.json({ ok: true, sessionId, stopped: true });
});

chat.post('/sessions/:sessionId/resume', async (c) => {
  const sessionId = c.req.param('sessionId');
  const runtime = sessionRuntime.get(sessionId);
  const snapshot = loadRuntimeSnapshot(sessionId);
  const lastInput = snapshot?.lastInput || runtime?.lastInput;
  if (!lastInput) {
    return c.json({ ok: false, error: 'session not found' }, 404);
  }
  const current = runtime || {
    agent: createAgent(sessionId),
    abortController: null,
    lastInput,
    running: false,
  };
  current.abortController = new AbortController();
  current.running = true;
  current.lastInput = lastInput;
  sessionRuntime.set(sessionId, current);
  appendTimelineEvent(sessionId, 'session-resume', { status: 'running', summary: '恢复上次运行' });
  const final = await current.agent.run(lastInput, current.abortController.signal, { resume: true });
  current.running = false;
  current.abortController = null;
  return c.json({ ok: true, sessionId, resumed: true, final });
});

export { chat };
