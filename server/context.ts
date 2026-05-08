// server/context.ts
import { SkillManager } from '../src/skills/skill-manager';
import { FileVectorStore } from '../src/vector/file-vector-store';
import { ModelConfigStore } from '../src/storage/model-config-store';
import { KnowledgeBase } from '../src/rag/knowledge-base';
import { MCPClient } from '../src/mcp/mcp-client';
import { ApiKeyStore } from '../src/security/key-store';
import { logBus } from '../src/observability/log-bus';

// 向量存储
export const vectorStore = new FileVectorStore('.agent');

// 技能管理器
export const skillManager = new SkillManager('.agent/skills', vectorStore);

// 模型配置
export const modelConfigStore = new ModelConfigStore('.agent/config.db');

// 知识库
export const knowledgeBase = new KnowledgeBase('.agent/docs', '.agent/knowledge-vectors.json');
// 启动时可选择索引：knowledgeBase.indexDocuments();

// MCP 客户端（按需初始化连接）
export const mcpClient = new MCPClient();
// 如有需要，可在此处连接默认服务器

// Agent 会话存储（保留会话实例，用于 SSE 恢复等）
export const sessions = new Map<string, any>();

export function registerAdditionalRoutes(app: any) {
  // ========== API Key 管理 ==========
  const keyStore = new ApiKeyStore('.agent/apikeys.db');
  app.get('/api/keys', (c: any) => c.json(keyStore.list()));
  app.post('/api/keys', async (c: any) => {
    const { name, plainKey } = await c.req.json();
    if (!plainKey) return c.json({ error: '缺少 plainKey' }, 400);
    const record = await keyStore.store(name, plainKey);
    return c.json({ id: record.id, name: record.name, masked: record.masked });
  });
  app.delete('/api/keys/:id', (c: any) => { keyStore.delete(c.req.param('id')); return c.json({ success: true }); });

  // ========== 实时日志流 ==========
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
