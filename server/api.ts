
// import { Hono } from 'hono'; import { AgentLoop } from '../src/core/agent-loop'; import { ReadFileTool, WriteFileTool, BashTool, GrepTool, GlobTool, WebFetchTool, WebSearchTool, EditFileTool, JsonQueryTool, GitTool, NotificationTool, ArchiveTool } from '../src/tools'; import { FileMemory } from '../src/memory/file-memory'; import { SlidingWindowContextManager } from '../src/context/sliding-window'; import { DiffUndoPolicy } from '../src/policy/diff-undo-policy'; import { SkillManager } from '../src/skills/skill-manager'; import { FileVectorStore } from '../src/vector/file-vector-store'; import { SkillDistillerTool } from '../src/tools/skill-distiller'; import { ApiKeyStore } from '../src/security/key-store'; import { CronStore } from '../src/cron/cron-store'; import { CronScheduler } from '../src/cron/cron-scheduler'; import { AgentEventBus } from '../src/core/events'; import OpenAI from 'openai';
// const app = new Hono(); const eventBus = AgentEventBus.getInstance(); const sessions = new Map<string, AgentLoop>();
// const vectorStore = new FileVectorStore('.agent'); const skillManager = new SkillManager('.agent/skills', vectorStore);
// const keyStore = new ApiKeyStore('.agent/apikeys.db'); const cronStore = new CronStore('.agent/cron.db'); const scheduler = new CronScheduler(cronStore);
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
// function createAgent(sessionId: string, overrides: any = {}) {
//   const config = {
//     model: overrides.model || 'gpt-4o', apiKey: overrides.apiKey || process.env.OPENAI_API_KEY, baseURL: overrides.baseURL || process.env.OPENAI_BASE_URL,
//     tools: [new ReadFileTool(), new WriteFileTool(), new BashTool(), new GrepTool(), new GlobTool(), new WebFetchTool(), new WebSearchTool(), new EditFileTool(), new JsonQueryTool(), new GitTool(), new NotificationTool(), new ArchiveTool(), new SkillDistillerTool(skillManager, openai)],
//     memory: new FileMemory({ path: `.agent/${sessionId}_memory.json` }), contextMgr: new SlidingWindowContextManager({ maxTokens: 8000, keepRecentTurns: 6, compressionThreshold: 0.9 }),
//     policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }), maxIterations: 15, skillManager,
//   };
//   const agent = new AgentLoop(config, sessionId); sessions.set(sessionId, agent); return agent;
// }
// app.get('/api/stream/:sessionId', async (c) => {
//   const sessionId = c.req.param('sessionId'); const input = c.req.query('input'); if (!input) return c.text('Missing', 400);
//   const model = c.req.query('model') || 'gpt-4o'; const apiKey = c.req.query('apiKey') || process.env.OPENAI_API_KEY; const baseURL = c.req.query('baseURL') || process.env.OPENAI_BASE_URL;
//   const agent = createAgent(sessionId, { model, apiKey, baseURL });
//   let closed = false; const stream = new ReadableStream({ start(controller) {
//     const send = (data: any) => { if(!closed) { try { controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(data)+'\n\n')); } catch {} } };
//     const handler = (data: any) => { if (data.sessionId === sessionId || data.type) send(data); };
//     eventBus.on('confirm-request', handler); eventBus.on('message-'+sessionId, handler);
//     agent.run(input).then(final => send({ type: 'final', content: final })).catch(e => send({ type: 'error', content: e.message })).finally(() => { eventBus.off('confirm-request', handler); eventBus.off('message-'+sessionId, handler); closed = true; try{ controller.close(); } catch {} });
//   }});
//   return c.newResponse(stream, { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
// });
// app.post('/api/confirm', async (c) => { const { sessionId, approved } = await c.req.json(); eventBus.emit('confirm-response', { sessionId, approved }); return c.json({ ok: true }); });
// // Cron, Keys, Skills, IM 等路由将在 main.ts 中挂载
// export { app, createAgent, keyStore, cronStore, scheduler, skillManager };
// server/api.ts
import { Hono } from 'hono';
import { chat } from './routes/chat';
import { skills } from './routes/skills';
import { modelConfig } from './routes/model-config';
import { memory } from './routes/memory';
import { statics } from './routes/static';
import { market } from './routes/market';
import { rag } from './routes/rag';
import { cron } from './routes/cron';
import { agent } from './routes/agents';
import { imRouter, registerAdapter } from './im/gateway';
import { WeComAdapter } from '../src/im/wecom-adapter';
import { DingTalkAdapter } from '../src/im/dingtalk-adapter';
import { FeishuAdapter } from '../src/im/feishu-adapter';
// import { rateLimit } from '../src/middleware/rate-limit';

// 注册适配器
if (process.env.WECOM_TOKEN) {
  registerAdapter('wecom', new WeComAdapter({
    token: process.env.WECOM_TOKEN,
    encodingAESKey: process.env.WECOM_ENCODING_AES_KEY!,
    corpId: process.env.WECOM_CORP_ID,
    webhookUrl: process.env.WECOM_WEBHOOK_URL,
  }));
}
if (process.env.DINGTALK_APP_SECRET) {
  registerAdapter('dingtalk', new DingTalkAdapter({
    appSecret: process.env.DINGTALK_APP_SECRET,
    webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
  }));
}
if (process.env.FEISHU_APP_SECRET) {
  registerAdapter('feishu', new FeishuAdapter({
    appSecret: process.env.FEISHU_APP_SECRET,
    webhookUrl: process.env.FEISHU_WEBHOOK_URL,
  }));
}

// 挂载路由
const app = new Hono();

app.route('/api', chat);
app.route('/api/skills', skills);
app.route('/api/model-config', modelConfig);
app.route('/api/memory', memory);
app.route('/api/rag', rag);
app.route('/api/market', market);
app.route('/api/cron', cron);
app.route('/im', imRouter);
app.route('/api/agents', agent);
app.get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }));
app.route('/', statics);

app.use('/api/*', async (c, next) => {
  const auth = c.req.header('Authorization');
  const token = auth?.replace('Bearer ', '');
  // const ip = c.req.header('x-forwarded-for') || 'unknown';
  // const allowed = await rateLimit(`ratelimit:${ip}`, 60, 60); // 60次/分
  if (token !== process.env.API_SECRET_TOKEN) {
    return c.text('Forbidden', 403);
  }
  // if (!allowed) return c.text('Too Many Requests', 429);  // 限流
  await next();
});
export default app;