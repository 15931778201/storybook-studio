// ── 核心抽象 ──
export { Tool, ToolError } from './core/tool';
export { Memory } from './core/memory';
export { ContextManager } from './core/context-manager';
export { Policy } from './core/policy';
export { AgentLoop } from './core/agent-loop';
export { Orchestrator } from './core/orchestrator';
export { AgentState } from './core/state';

// ── 具体工具 ──
export { ReadFileTool } from './tools/read-file';
export { WriteFileTool } from './tools/write-file';
export { BashTool } from './tools/bash';
export { GrepTool } from './tools/grep';
export { GlobTool } from './tools/glob';

// ── 上下文策略 ──
export { SlidingWindowContextManager } from './context/sliding-window';
export { buildSystemPrompt } from './context/system-prompt';

// ── 记忆实现 ──
export { FileMemory } from './memory/file-memory';

// ── 安全策略 ──
export { DefaultPolicy } from './policy/default-policy';
export { DiffUndoPolicy } from './policy/diff-undo-policy';
export { PermissionLevel } from './policy/permissions';

// ── 工具函数 ──
export { generateUnifiedDiff } from './utils/diff';
export { createBackup, restoreBackup } from './utils/backup';
export { appendAuditLog } from './utils/logger';
export { executeSafely } from './utils/sandbox';

// ── 类型 ──
export type { Message, ToolCall, ToolResult } from './types/message';
export type { AgentConfig } from './types/config';

// Skill 相关
export { SkillManager } from './skills/skill-manager';
export { SkillExecutor } from './skills/skill-executor';
export { SkillCallerTool, ListSkillsTool } from './tools/skill-caller';
export { CreateSkillTool, UpdateSkillTool } from './tools/skill-creator';
export type { SkillMetadata, SkillStep, SkillExecutionResult, StepResult } from './types/skill';

// ── 向量存储 ──
export { FileVectorStore } from './vector/file-vector-store';

export { MCPClient } from './mcp/mcp-client';
export { KnowledgeBase } from './rag/knowledge-base';
