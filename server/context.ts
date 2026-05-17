import { SkillManager } from '../src/skills/skill-manager';
import { SkillImporter } from '../src/skills/skill-importer';
import { FileVectorStore } from '../src/vector/file-vector-store';
import { ModelConfigStore } from '../src/storage/model-config-store';
import { RoleStore } from '../src/storage/role-store';
import { KnowledgeBaseManager } from '../src/rag/knowledge-manager';
import { MCPClient } from '../src/mcp/mcp-client';
import { ApiKeyStore } from '../src/security/key-store';
import { logBus } from '../src/observability/log-bus';
import { LogRotator } from '../src/utils/log-rotator';
import { ChangelogStore } from '../src/changelog/changelog-store';
import { CronStore } from '../src/cron/cron-store';
import { CronScheduler } from '../src/cron/cron-scheduler';
import { setDefaultEmbeddingConfig } from '../src/vector/embeddings';

export const vectorStore = new FileVectorStore('.agent/vectors.json');

export const skillManager = new SkillManager('.agent/skills', vectorStore);

export const skillImporter = new SkillImporter(skillManager);

export const modelConfigStore = new ModelConfigStore('.agent/config.db');

// 从存储的配置中读取嵌入配置作为默认值
const storedConfig = modelConfigStore.get();
if (storedConfig) {
  setDefaultEmbeddingConfig({
    model: storedConfig.embeddingModel,
    apiKey: storedConfig.embeddingApiKey,
    baseURL: storedConfig.embeddingBaseURL,
  });
}

export const roleStore = new RoleStore('.agent/roles.db');

export const knowledgeBaseManager = new KnowledgeBaseManager('.agent/knowledge', {
  chunkSize: 1500,
  chunkOverlap: 200,
  keywordWeight: 0.3,
});

export const mcpClient = new MCPClient();

export const sessions = new Map<string, any>();

export const logRotator = new LogRotator();

export const changelogStore = new ChangelogStore();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function initLogRotator(): void {
  (globalThis as any).__logRotator = logRotator;
  logRotator.cleanOldLogs();

  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      logRotator.cleanOldLogs().catch(() => {});
    }, 3600000);
  }
}

export async function initChangelogCron(): Promise<void> {
  try {
    const cronStore = new CronStore('.agent/cron.db');
    const scheduler = new CronScheduler(cronStore);

    await scheduler.start();

    const jobs = await cronStore.list();
    const existing = jobs.find((j: any) => j.name === 'git-changelog-scan');
    if (!existing) {
      const created = await cronStore.create({
        name: 'git-changelog-scan',
        description: 'Scan git log and create changelog entries for new commits',
        cronExpression: '*/30 * * * *',
        prompt: `Scan git log for new commits since last scan and create changelog entries. Parse commit messages:
- feat/feature → requirement
- fix/hotfix → bug
- refactor/docs/chore/style/perf/test → optimization

Skip other commits. For each matched commit, create a changelog entry with title=commit subject, trigger=git, commitHash=full SHA.

IMPORTANT: Before scanning, call "ChangelogStore.getLastScanTime()" to get the last scan time. If it returns null, scan the last 24 hours.
Run: git log --oneline --after="<lastScanTime>" --format="%H||%s"`,
        enabled: true,
      });
      scheduler.scheduleJob(created);
    }
  } catch (err) {
    console.error('初始化变更日志定时任务失败:', err);
  }
}

export function registerAdditionalRoutes(app: any) {
  const keyStore = new ApiKeyStore('.agent/apikeys.db');
  app.get('/api/keys', (c: any) => c.json(keyStore.list()));
  app.post('/api/keys', async (c: any) => {
    const { name, plainKey } = await c.req.json();
    if (!plainKey) return c.json({ error: '缺少 plainKey' }, 400);
    const record = await keyStore.store(name, plainKey);
    return c.json({ id: record.id, name: record.name, masked: record.masked });
  });
  app.delete('/api/keys/:id', (c: any) => { keyStore.delete(c.req.param('id')); return c.json({ success: true }); });

  app.get('/api/logs/stream', (c: any) => {
    const stream = new ReadableStream({
      start(controller: any) {
        const handler = (entry: any) => {
          try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(entry)}\n\n`)); } catch {}
        };
        logBus.on('log', handler);
        c.req.raw.signal.addEventListener('abort', () => { logBus.off('log', handler); try { controller.close(); } catch {} });
      },
    });
    return c.newResponse(stream, { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  });
}
