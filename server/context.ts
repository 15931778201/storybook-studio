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
import type { CronJob } from '../src/types/cron';
import fs from 'fs';
import path from 'path';

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

// 新增：清理临时文件的函数
async function cleanupTempFiles(): Promise<void> {
  const tempDir = path.join(process.cwd(), '.agent', 'temp');
  if (!fs.existsSync(tempDir)) {
    return;
  }
  
  try {
    const files = fs.readdirSync(tempDir);
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1小时前的时间戳
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stat = fs.statSync(filePath);
        // 如果文件名是数字（时间戳）且文件创建时间超过1小时，则删除
        if (/^\d+\.jpg$/.test(file) && stat.birthtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
          console.log(`🧹 清理临时文件: ${filePath}`);
        }
      } catch (error) {
        console.warn(`⚠️ 处理临时文件失败: ${filePath}`, error);
      }
    }
  } catch (error) {
    console.warn('⚠️ 清理临时文件目录失败:', error);
  }
}

export function initLogRotator(): void {
  (globalThis as any).__logRotator = logRotator;
  logRotator.cleanOldLogs();
  cleanupTempFiles().catch(() => {});

  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      logRotator.cleanOldLogs().catch(() => {});
      cleanupTempFiles().catch(() => {});
    }, 3600000); // 每小时执行一次
  }
}

// 新增：处理 changelog cron 任务的实际执行逻辑
async function executeChangelogCron(job: CronJob): Promise<void> {
  if (job.name !== 'git-changelog-scan') {
    return;
  }

  try {
    console.log('🔍 开始执行 Git 变更日志扫描...');
    
    // 获取上次扫描时间
    const lastScanTime = await changelogStore.getLastScanTime();
    let afterTime: string;
    
    if (lastScanTime) {
      afterTime = lastScanTime;
    } else {
      // 如果没有上次扫描时间，扫描过去24小时
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      afterTime = twentyFourHoursAgo.toISOString();
    }

    // 执行 git log 命令
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    
    const format = '%H||%s'; // commit hash || subject
    const args = ['log', '--oneline', `--after=${afterTime}`, `--format=${format}`];
    
    let stdout: string;
    try {
      const result = await execFileAsync('git', args, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5,
        cwd: process.cwd(),
      });
      stdout = result.stdout;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('⚠️ 未找到 git 命令，跳过变更日志扫描');
        return;
      }
      if (error.message?.includes('not a git repository')) {
        console.warn('⚠️ 当前目录不是 git 仓库，跳过变更日志扫描');
        return;
      }
      throw error;
    }

    if (!stdout.trim()) {
      console.log('✅ Git 扫描完成，无新提交');
      await changelogStore.updateScanTime();
      return;
    }

    // 解析 commit 日志
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    const entriesToCreate: Array<{
      type: string;
      title: string;
      trigger: string;
      commitHash: string;
    }> = [];

    for (const line of lines) {
      const parts = line.split('||');
      if (parts.length !== 2) continue;
      
      const commitHash = parts[0].trim();
      const subject = parts[1].trim();
      
      if (!commitHash || !subject) continue;
      
      // 根据 commit message 判断类型
      let type = 'optimization'; // 默认类型
      
      const lowerSubject = subject.toLowerCase();
      if (lowerSubject.includes('feat') || lowerSubject.includes('feature') || 
          lowerSubject.includes('需求') || lowerSubject.includes('add') || 
          lowerSubject.includes('新增')) {
        type = 'requirement';
      } else if (lowerSubject.includes('fix') || lowerSubject.includes('hotfix') || 
                 lowerSubject.includes('bug') || lowerSubject.includes('修复') || 
                 lowerSubject.includes('error') || lowerSubject.includes('issue')) {
        type = 'bug';
      } else if (lowerSubject.includes('refactor') || lowerSubject.includes('docs') || 
                 lowerSubject.includes('chore') || lowerSubject.includes('style') || 
                 lowerSubject.includes('perf') || lowerSubject.includes('test') ||
                 lowerSubject.includes('优化') || lowerSubject.includes('重构') ||
                 lowerSubject.includes('提升') || lowerSubject.includes('改进')) {
        type = 'optimization';
      } else {
        // 跳过其他类型的提交
        continue;
      }

      entriesToCreate.push({
        type,
        title: subject,
        trigger: 'git',
        commitHash,
      });
    }

    if (entriesToCreate.length > 0) {
      const createdCount = await changelogStore.bulkCreate(entriesToCreate);
      console.log(`✅ 成功创建 ${createdCount} 条变更日志条目`);
    } else {
      console.log('✅ Git 扫描完成，无匹配的提交类型');
    }

    // 更新扫描时间
    await changelogStore.updateScanTime();
    console.log('✅ Git 变更日志扫描完成');

  } catch (error) {
    console.error('❌ Git 变更日志扫描失败:', error);
  }
}

export async function initChangelogCron(): Promise<void> {
  try {
    const cronStore = new CronStore('.agent/cron.db');
    const scheduler = new CronScheduler(cronStore);

    // 监听 cron trigger 事件
    scheduler.on('trigger', async (job: any) => {
      await executeChangelogCron(job);
    });

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
