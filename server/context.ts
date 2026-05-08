// server/context.ts
import { SkillManager } from '../src/skills/skill-manager';
import { FileVectorStore } from '../src/vector/file-vector-store';
import { ModelConfigStore } from '../src/storage/model-config-store';
import { KnowledgeBase } from '../src/rag/knowledge-base';
import { MCPClient } from '../src/mcp/mcp-client';

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