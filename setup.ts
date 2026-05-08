// setup.ts - 第一部分
import fs from 'fs';
import path from 'path';

const FILES: Record<string, string> = {};

// ========== 基础类型 ==========
FILES['src/types/config.ts'] = `export interface AgentConfig {
  model: string;
  apiKey?: string;
  baseURL?: string;
  tools: any[];
  memory: any;
  contextMgr: any;
  policy: any;
  maxIterations: number;
  skillManager?: any;
  knowledgeBase?: any;
  mcpClient?: any;
  supportsVision?: boolean;
}
`;

FILES['src/types/message.ts'] = `export interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'thinking';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  steps?: any[];
  timestamp?: number;
  imageBase64?: string;
}
export interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
export interface ToolResult { success: boolean; output: string; metadata?: any; }
`;

FILES['src/types/skill.ts'] = `export interface SkillMetadata {
  name: string; title: string; description: string;
  version: string; author: string; tags: string[];
  createdAt: string; updatedAt: string;
}
export interface SkillStep {
  id: string; order: number; tool: string;
  params: Record<string, any>; description: string;
  condition?: string; onError?: 'skip' | 'stop' | 'retry';
}
export interface ParsedSkill {
  metadata: SkillMetadata; steps: SkillStep[]; raw: string;
}
export interface SkillExecutionResult { success: boolean; skillName: string; stepsCompleted: number; stepsTotal: number; results: any[]; summary: string; }
export interface StepResult { stepId: string; order: number; tool: string; success: boolean; output: string; error?: string; }
`;

FILES['src/types/thinking.ts'] = `export interface ThinkingStep {
  id: string; toolName: string; args: string; result: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'denied';
}
`;

// ========== 核心抽象 ==========
FILES['src/core/tool.ts'] = `
import { z } from 'zod';
export interface ToolResult { success: boolean; output: string; metadata?: Record<string, unknown>; }
export class ToolError extends Error {
  constructor(message: string, public toolName: string, public params: Record<string, any>, public isRetryable: boolean = false) { super(message); this.name = 'ToolError'; }
}
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodTypeAny;
  async execute(rawParams: Record<string, unknown>): Promise<ToolResult> {
    const parsed = this.parameters.safeParse(rawParams);
    if (!parsed.success) return { success: false, output: \`[\${this.name}] 参数校验失败: \${parsed.error.issues.map(i => i.message).join('; ')}\` };
    return this.executeCore(parsed.data);
  }
  protected abstract executeCore(validatedParams: unknown): Promise<ToolResult>;
}
export async function safeExecute(toolName: string, fn: () => Promise<ToolResult>, options?: { timeout?: number; maxOutput?: number; fallback?: () => Promise<ToolResult> }): Promise<ToolResult> {
  const maxOutput = options?.maxOutput ?? 4000;
  let timeoutMs = options?.timeout ?? 30000;
  if (typeof timeoutMs !== 'number' || isNaN(timeoutMs) || timeoutMs <= 0) timeoutMs = 30000;
  if (timeoutMs > 2147483647) timeoutMs = 2147483647;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error(\`工具 \${toolName} 执行超时(\${timeoutMs}ms)\`)), timeoutMs))
    ]);
    return { ...result, success: true, output: result.output.slice(0, maxOutput) };
  } catch (err: any) {
    if (options?.fallback) return options.fallback();
    return { success: false, output: \`[\${toolName} 执行失败] \${err.message}\` };
  }
}
`;

FILES['src/core/state.ts'] = `import type { Message } from '../types/message';
export class AgentState { messages: Message[] = []; addMessage(msg: Message) { this.messages.push(msg); } }
`;

FILES['src/core/events.ts'] = `import { EventEmitter } from 'events';
export class AgentEventBus extends EventEmitter {
  private static instance: AgentEventBus;
  static getInstance() { if (!this.instance) this.instance = new AgentEventBus(); return this.instance; }
}
`;

FILES['src/core/policy.ts'] = `export class PolicyResult { allowed: boolean = true; reason?: string; diff?: string | null; needApproval?: boolean; }
export abstract class Policy {
  abstract preExecute(tool: any, params: Record<string, any>): Promise<PolicyResult>;
  abstract postExecute(tool: any, params: any, result: any): Promise<void>;
  abstract undo(operationId: string): Promise<string>;
  abstract getAuditLog(limit?: number): Promise<any[]>;
}
`;

FILES['src/core/memory.ts'] = `export interface MemoryItem { key: string; content: string; metadata?: Record<string, unknown>; createdAt: string; updatedAt: string; }
export abstract class Memory {
  abstract add(item: Omit<MemoryItem, 'createdAt' | 'updatedAt'>): Promise<void>;
  abstract search(query: string, topK?: number): Promise<MemoryItem[]>;
  abstract getAll(): Promise<MemoryItem[]>;
  abstract extractFromConversation(messages: any[]): Promise<MemoryItem[]>;
  abstract delete(key: string): Promise<void>;
}
`;

FILES['src/core/context-manager.ts'] = `export interface ContextManagerOptions { maxTokens: number; keepRecentTurns: number; compressionThreshold: number; }
export abstract class ContextManager {
  constructor(protected options: ContextManagerOptions) {}
  abstract compress(messages: any[]): Promise<any[]>;
  abstract injectSystemPrompt(messages: any[], memories: any[], projectContext: string): any[];
  abstract checkThreshold(messages: any[]): boolean;
}
`;

// ========== 核心工具 ==========
FILES['src/tools/bash.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class BashTool extends Tool {
  name = 'bash';
  description = '执行 Shell 命令（参数化，安全防注入）';
  parameters = z.object({
    command: z.string(),
    args: z.preprocess((val: any) => typeof val === 'string' ? val.split(' ').filter(Boolean) : val, z.array(z.string()).optional().default([])),
    timeout: z.coerce.number().int().min(1000).max(120000).optional().default(30000)
  });
  protected async executeCore(validatedParams: any) {
    const { command, args = [], timeout } = validatedParams;
    const safeTimeout = Math.min(Math.max(Number(timeout) || 30000, 1000), 2147483647);
    return safeExecute(this.name, async () => {
      const { stdout, stderr } = await execFileAsync(command, args, { timeout: safeTimeout, maxBuffer: 5*1024*1024 });
      return { success: true, output: stdout + (stderr ? '\\n[STDERR] ' + stderr : '') };
    }, { timeout: safeTimeout + 5000, maxOutput: 4000 });
  }
}
`;

FILES['src/tools/read-file.ts'] = `
import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
export class ReadFileTool extends Tool {
  name = 'read_file'; description = '读取指定文件的内容';
  parameters = z.object({ filePath: z.string(), offset: z.coerce.number().int().min(0).optional().default(0), limit: z.coerce.number().int().min(1).optional().default(500) });
  protected async executeCore(validatedParams: any) {
    const { filePath, offset, limit } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) throw new ToolError('文件不存在', this.name, { filePath });
      const lines = fs.readFileSync(fullPath, 'utf-8').split('\\n');
      return { success: true, output: lines.slice(offset, offset + limit).join('\\n') };
    });
  }
}
`;

FILES['src/tools/write-file.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
export class WriteFileTool extends Tool {
  name = 'write_file'; description = '将内容写入文件，自动备份并生成 diff 预览';
  parameters = z.object({ filePath: z.string(), content: z.string() });
  protected async executeCore(validatedParams: any) {
    const { filePath, content } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      let diff: string | null = null;
      if (fs.existsSync(fullPath)) { const old = fs.readFileSync(fullPath, 'utf8'); diff = generateUnifiedDiff(old, content, filePath); }
      const backupPath = createBackup(fullPath);
      fs.writeFileSync(fullPath, content, 'utf8');
      appendAuditLog({ tool: this.name, filePath, backupPath, diff, timestamp: new Date().toISOString() });
      return { success: true, output: \`文件 \${filePath} 写入成功\`, metadata: { backupPath, diff } };
    });
  }
}
`;

FILES['src/tools/grep.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class GrepTool extends Tool {
  name = 'grep'; description = '在项目中搜索模式';
  parameters = z.object({ pattern: z.string(), path: z.string().optional().default('.'), include: z.string().optional() });
  protected async executeCore(validatedParams: any) {
    const { pattern, path, include } = validatedParams;
    const args = ['-r', '-n', '--color=never']; if (include) args.push('--include', include); args.push(pattern, path);
    return safeExecute(this.name, async () => { const { stdout } = await execFileAsync('grep', args, { timeout: 15000, maxBuffer: 5*1024*1024 }); return { success: true, output: stdout.slice(0, 5000) }; }, { timeout: 20000, maxOutput: 5000 });
  }
}
`;

FILES['src/tools/glob.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class GlobTool extends Tool {
  name = 'glob'; description = '按模式查找文件';
  parameters = z.object({ pattern: z.string(), path: z.string().optional().default('.'), args: z.preprocess((val: any) => typeof val === 'string' ? val.split(' ').filter(Boolean) : val, z.array(z.string()).optional().default([])) });
  protected async executeCore(validatedParams: any) {
    const { pattern, path, args = [] } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullArgs = [path, '-name', pattern, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*', '-maxdepth', '10', ...args];
      const { stdout } = await execFileAsync('find', fullArgs, { timeout: 10000, maxBuffer: 5*1024*1024 });
      return { success: true, output: stdout.slice(0, 5000) };
    }, { timeout: 15000, maxOutput: 5000 });
  }
}
`;

// ========== 工具辅助函数 ==========
FILES['src/utils/backup.ts'] = `
import fs from 'fs'; import path from 'path';
export function createBackup(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const dir = '.agent/backups'; fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, \`\${path.basename(filePath)}.\${Date.now()}.bak\`);
  fs.copyFileSync(filePath, backup); return backup;
}
export function restoreBackup(backup: string, target: string) { fs.copyFileSync(backup, target); }
`;

FILES['src/utils/diff.ts'] = `
import { createPatch } from 'diff';
export function generateUnifiedDiff(oldStr: string, newStr: string, filePath: string): string {
  return createPatch(filePath, oldStr, newStr, 'a', 'b');
}
`;

FILES['src/utils/logger.ts'] = `
import fs from 'fs';
export function appendAuditLog(entry: any, logPath = '.agent/audit.jsonl') { fs.appendFileSync(logPath, JSON.stringify(entry) + '\\n'); }
`;

// ========== 上下文管理 ==========
FILES['src/context/token-counter.ts'] = `export function tokenCount(messages: any[]): number { return messages.reduce((s, m) => s + (m.content?.length || 0) * 0.25, 0); }`;

FILES['src/context/sliding-window.ts'] = `
import { ContextManager, ContextManagerOptions } from '../core/context-manager';
import { tokenCount } from './token-counter';
import OpenAI from 'openai';
export class SlidingWindowContextManager extends ContextManager {
  private summaryModel: OpenAI;
  constructor(options: ContextManagerOptions) {
    super(options);
    this.summaryModel = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL, timeout: 30000 });
  }
  async compress(messages: any[]): Promise<any[]> {
    if (tokenCount(messages) <= this.options.maxTokens * this.options.compressionThreshold) return messages;
    const keep = this.options.keepRecentTurns * 2;
    const toCompress = messages.slice(0, -keep), recent = messages.slice(-keep);
    let summary: string;
    try { summary = await this.generateSummary(toCompress); } catch { return recent; }
    return [{ role: 'system', content: \`[历史摘要]\\n\${summary}\\n\\n--- 最近对话 ---\` }, ...recent];
  }
  async generateSummary(messages: any[]): Promise<string> {
    const res = await this.summaryModel.chat.completions.create({
      model: 'gpt-4o-mini', messages: [{ role: 'user', content: \`压缩以下对话历史，保留重要决策、文件修改、未解决问题。不超过300字。\\n\${JSON.stringify(messages)}\` }], max_tokens: 400, temperature: 0.1
    });
    return res.choices[0].message.content || '无摘要';
  }
  checkThreshold(messages: any[]): boolean { return tokenCount(messages) > this.options.maxTokens * this.options.compressionThreshold; }
  injectSystemPrompt(messages: any[], memories: any[], projectContext: string): any[] {
    const memStr = memories.map((m: any) => \`- \${m.key}: \${m.content}\`).join('\\n');
    const system = [projectContext ? \`项目: \${projectContext}\` : '', memStr ? \`偏好:\\n\${memStr}\` : ''].filter(Boolean).join('\\n\\n');
    return system ? [{ role: 'system', content: system }, ...messages] : messages;
  }
}
`;

FILES['src/memory/file-memory.ts'] = `
import { Memory, MemoryItem } from '../core/memory';
import fs from 'fs';
export class FileMemory extends Memory {
  private cache: MemoryItem[] = [];
  private filePath: string;
  constructor(options: { path: string }) { super(); this.filePath = options.path; this.load(); }
  private load() { try { if (fs.existsSync(this.filePath)) this.cache = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')); } catch { this.cache = []; } }
  private save() { fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2)); }
  async add(item: Omit<MemoryItem, 'createdAt' | 'updatedAt'>) { const now = new Date().toISOString(); this.cache.push({ ...item, createdAt: now, updatedAt: now }); this.save(); }
  async getAll() { return this.cache; }
  async search(query: string, topK = 5) { return this.cache.filter(i => i.content.includes(query)).slice(0, topK); }
  async extractFromConversation(messages: any[]) { return []; }
  async delete(key: string) { this.cache = this.cache.filter(i => i.key !== key); this.save(); }
}
`;

// 策略
FILES['src/policy/default-policy.ts'] = `
import { Policy, PolicyResult } from '../core/policy';
export class DefaultPolicy extends Policy {
  async preExecute() { return new PolicyResult(); }
  async postExecute() {}
  async undo() { return 'undo not supported'; }
  async getAuditLog(limit = 20) { return []; }
}
`;

FILES['src/policy/diff-undo-policy.ts'] = `
import { Policy, PolicyResult } from '../core/policy';
import fs from 'fs';
import { createBackup, restoreBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
export type PermissionLevel = 'default' | 'acceptEdits' | 'bypassPermissions' | 'readOnly';
type OperationType = 'read' | 'write' | 'execute' | 'network';
const MATRIX: Record<PermissionLevel, OperationType[]> = {
  readOnly: ['read'], default: ['read','write','execute'], acceptEdits: ['read','write','execute'], bypassPermissions: ['read','write','execute','network']
};
export class DiffUndoPolicy extends Policy {
  private currentLevel: PermissionLevel = 'default';
  private opCount = new Map<string, number>();
  private MAX = 100;
  setPermissionLevel(level: PermissionLevel) { this.currentLevel = level; this.opCount.clear(); }
  private classifyOp(toolName: string): OperationType {
    if (['read_file','grep','glob','list_skills'].includes(toolName)) return 'read';
    if (['write_file','edit_file'].includes(toolName)) return 'write';
    if (['bash'].includes(toolName)) return 'execute';
    return 'network';
  }
  async preExecute(tool: any, params: any): Promise<PolicyResult> {
    const res = new PolicyResult();
    const op = this.classifyOp(tool.name);
    if (!MATRIX[this.currentLevel].includes(op)) { res.allowed = false; res.reason = \`权限级别 \${this.currentLevel} 不允许 \${op} 操作\`; return res; }
    const cnt = (this.opCount.get(tool.name) || 0) + 1; this.opCount.set(tool.name, cnt);
    if (cnt > this.MAX) { res.allowed = false; res.reason = '操作次数超限'; return res; }
    if (op === 'write' && this.currentLevel === 'default') {
      const diff = tool.name === 'write_file' ? this.genDiff(tool, params) : null;
      res.diff = diff; res.needApproval = true;
    }
    return res;
  }
  private genDiff(tool: any, params: any): string | null {
    if (!fs.existsSync(params.filePath)) return null;
    return generateUnifiedDiff(fs.readFileSync(params.filePath, 'utf8'), params.content, params.filePath);
  }
  async postExecute(tool: any, params: any, result: any) { appendAuditLog({ tool: tool.name, params, result }); }
  async undo(filePath: string) { return 'undo 需要审计日志支持'; }
  async getAuditLog(limit = 20) { return []; }
}
`;

// ========== 向量存储 ==========
FILES['src/vector/vector-store.ts'] = `export interface VectorDocument { id: string; content: string; metadata: Record<string, any>; }
export interface VectorStore { addDocuments(docs: VectorDocument[], embeddings: number[][]): Promise<void>; similaritySearch(queryEmbedding: number[], k: number): Promise<VectorDocument[]>; deleteByIds(ids: string[]): Promise<void>; persist(): Promise<void>; }
`;

FILES['src/vector/file-vector-store.ts'] = `
import fs from 'fs'; import path from 'path';
import { VectorStore, VectorDocument } from './vector-store';
export class FileVectorStore implements VectorStore {
  private filePath: string; private vectors: any[] = [];
  constructor(baseDir: string = '.agent') { this.filePath = path.join(baseDir, 'vectors.json'); this.load(); }
  private load() { try { if (fs.existsSync(this.filePath)) this.vectors = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')); } catch { this.vectors = []; } }
  async addDocuments(docs: VectorDocument[], embeddings: number[][]) {
    for (let i=0; i<docs.length; i++) this.vectors.push({ id: docs[i].id, content: docs[i].content, metadata: docs[i].metadata, embedding: embeddings[i] });
    await this.persist();
  }
  async similaritySearch(query: number[], k: number): Promise<VectorDocument[]> {
    return this.vectors.map(v => ({ doc: { id: v.id, content: v.content, metadata: v.metadata }, score: cosineSim(query, v.embedding) }))
      .sort((a,b) => b.score - a.score).slice(0, k).map(x => x.doc);
  }
  async deleteByIds(ids: string[]) { this.vectors = this.vectors.filter(v => !ids.includes(v.id)); await this.persist(); }
  async persist() { fs.mkdirSync(path.dirname(this.filePath), { recursive: true }); fs.writeFileSync(this.filePath, JSON.stringify(this.vectors)); }
}
function cosineSim(a: number[], b: number[]): number { let dot=0, na=0, nb=0; for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return dot/(Math.sqrt(na)*Math.sqrt(nb)+1e-10); }
`;

FILES['src/vector/embeddings.ts'] = `
import OpenAI from 'openai';
const getClient = () => new OpenAI({ apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL, timeout: 30000 });
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (process.env.DISABLE_VECTOR_SEARCH === 'true') return texts.map(() => []);
  try { const res = await getClient().embeddings.create({ model: 'text-embedding-3-small', input: texts }); return res.data.map(d => d.embedding); }
  catch (e: any) { if (e.status === 404 || e.status === 403) { const fallback = await getClient().embeddings.create({ model: 'text-embedding-ada-002', input: texts }); return fallback.data.map(d => d.embedding); } throw e; }
}
export async function generateSingleEmbedding(text: string): Promise<number[]> { return (await generateEmbeddings([text]))[0] || []; }
`;

// ========== 技能管理器（按需加载版） ==========
FILES['src/skills/skill-manager.ts'] = `
import fs from 'fs'; import path from 'path';
import { ParsedSkill, SkillStep, SkillMetadata } from '../types/skill';
import { VectorStore, VectorDocument } from '../vector/vector-store';
import { generateEmbeddings, generateSingleEmbedding } from '../vector/embeddings';
export class SkillManager {
  private skillsDir: string; private vectorStore: VectorStore;
  private metaCache: Map<string, SkillMetadata> = new Map();
  private indexed = false;
  constructor(baseDir='.agent/skills', vectorStore: VectorStore) {
    this.skillsDir = path.resolve(process.cwd(), baseDir); this.vectorStore = vectorStore;
    fs.mkdirSync(this.skillsDir, { recursive: true }); this.refreshMetaCache();
  }
  private refreshMetaCache() { this.metaCache.clear(); const files = fs.readdirSync(this.skillsDir).filter(f=>f.endsWith('.md')); for(const f of files){ const m = this.parseMetaOnly(f); if(m) this.metaCache.set(m.name, m); } }
  private parseMetaOnly(fn: string): SkillMetadata | null {
    try { const c = fs.readFileSync(path.join(this.skillsDir, fn), 'utf8'); const fm = c.match(/^---\\n([\\s\\S]*?)\\n---/); if(!fm) return { name: fn.replace('.md',''), title: fn.replace('.md',''), description:'', version:'1.0', author:'', tags:[], createdAt:'', updatedAt:'' };
      const meta: any = {}; fm[1].split('\\n').forEach(line=>{ const i=line.indexOf(':'); if(i>0) meta[line.slice(0,i).trim()]=line.slice(i+1).trim(); });
      return { name: meta.name||fn.replace('.md',''), title: meta.title||meta.name, description: meta.description||'', version: meta.version||'1.0', author: meta.author||'', tags: meta.tags?meta.tags.split(',').map((t:string)=>t.trim()):[], createdAt: meta.createdAt||'', updatedAt: meta.updatedAt||'' };
    } catch { return null; }
  }
  private loadFull(name: string): ParsedSkill | null {
    const fp = path.join(this.skillsDir, \`\${name}.md\`); if(!fs.existsSync(fp)) return null;
    const c = fs.readFileSync(fp,'utf8'); return this.parseContent(c, name);
  }
  parseContent(content: string, source='inline'): ParsedSkill | null {
    try { const fm = content.match(/^---\\n([\\s\\S]*?)\\n---\\n([\\s\\S]*)\$/); let meta: any={}; if(fm){ fm[1].split('\\n').forEach(line=>{ const i=line.indexOf(':'); if(i>0) meta[line.slice(0,i).trim()]=line.slice(i+1).trim(); }); }
      const steps = this.parseSteps(fm?fm[2]:content);
      return { metadata: { name: meta.name||source, title: meta.title||source, description: meta.description||'', version: meta.version||'1.0', author: meta.author||'', tags: meta.tags?meta.tags.split(',').map((t:string)=>t.trim()):[], createdAt: meta.createdAt||'', updatedAt: new Date().toISOString() }, steps, raw: content };
    } catch { return null; }
  }
  private parseSteps(md: string): SkillStep[] { const steps: SkillStep[]=[]; const re = /^-\\s+(\\w+):\\s*(.+)\$/gm; let m; let o=1; while((m=re.exec(md))!==null){ steps.push({ id:\`step-\${o}\`, order:o, tool:m[1], params: this.safeJson(m[2]), description:'' }); o++; } return steps; }
  private safeJson(s: string): any { try{return JSON.parse(s)}catch{return{raw:s}} }
  getSkillMeta(name: string) { return this.metaCache.get(name)||null; }
  getSkill(name: string) { return this.loadFull(name); }
  listSkills(): ParsedSkill[] { return Array.from(this.metaCache.values()).map(m=>({metadata:m, steps:[], raw:''})); }
  searchSkills(q: string): ParsedSkill[] { const l=q.toLowerCase(); return this.listSkills().filter(s=>s.metadata.name.includes(l)||s.metadata.title.includes(l)||s.metadata.description.includes(l)||s.metadata.tags.some(t=>t.includes(l))); }
  async searchRelevantSkills(query: string, topK=3): Promise<string> {
    if(process.env.DISABLE_VECTOR_SEARCH==='true'||this.metaCache.size===0) return '';
    try { if(!this.indexed) await this.buildIndex(); const emb = await generateSingleEmbedding(query); if(!emb||emb.length===0) return '';
      const results = await this.vectorStore.similaritySearch(emb, topK); if(!results.length) return '';
      return \`📚 相关技能：\\n\${results.map(r=>\`[\${r.metadata.skillName}] \${r.content}\`).join('\\n')}\`; } catch(e){ console.warn('技能检索失败', e); return ''; }
  }
  private async buildIndex() { for(const name of this.metaCache.keys()){ const skill = this.loadFull(name); if(skill) await this.indexSkill(skill); } this.indexed=true; }
  private async indexSkill(skill: ParsedSkill) {
    const docs: VectorDocument[]=[]; const texts: string[]=[];
    const ov = \`技能: \${skill.metadata.title}\\n描述: \${skill.metadata.description}\`; texts.push(ov); docs.push({ id:\`\${skill.metadata.name}-overview\`, content:ov, metadata:{skillName:skill.metadata.name, type:'overview'} });
    for(const step of skill.steps){ const t = \`步骤\${step.order}: \${step.description} 工具: \${step.tool} 参数: \${JSON.stringify(step.params)}\`; texts.push(t); docs.push({ id:\`\${skill.metadata.name}-step-\${step.order}\`, content:t, metadata:{skillName:skill.metadata.name, type:'step', stepId:step.id} }); }
    const embs = await generateEmbeddings(texts); await this.vectorStore.addDocuments(docs, embs);
  }
  async reindex() { this.indexed=false; await this.buildIndex(); }
  createSkill(name: string, title: string, description: string, steps: SkillStep[], tags: string[]=[]): ParsedSkill | null {
    const skill: ParsedSkill = { metadata: { name, title, description, version:'1.0', author:'agent', tags, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, steps, raw:'' };
    const c = this.skillToMarkdown(skill); fs.writeFileSync(path.join(this.skillsDir, \`\${name}.md\`), c, 'utf8'); this.metaCache.set(name, skill.metadata); this.indexed=false; return skill;
  }
  deleteSkill(name: string): boolean { const fp = path.join(this.skillsDir, \`\${name}.md\`); if(fs.existsSync(fp)) fs.unlinkSync(fp); return this.metaCache.delete(name); }
  updateSkill(name: string, updates: Partial<SkillMetadata> & { steps?: SkillStep[] }): ParsedSkill | null {
    const skill = this.loadFull(name); if(!skill) return null;
    if(updates.steps) skill.steps = updates.steps;
    Object.assign(skill.metadata, { ...updates, updatedAt: new Date().toISOString() }); delete (skill.metadata as any).steps;
    const c = this.skillToMarkdown(skill); fs.writeFileSync(path.join(this.skillsDir, \`\${name}.md\`), c, 'utf8'); this.metaCache.set(name, skill.metadata); this.indexed=false; return skill;
  }
  skillToMarkdown(skill: ParsedSkill): string {
    const m = skill.metadata; let md = '---\\n'; md += \`name: \${m.name}\\ntitle: \${m.title}\\ndescription: \${m.description}\\nversion: \${m.version}\\nauthor: \${m.author}\\ntags: \${m.tags.join(', ')}\\ncreatedAt: \${m.createdAt}\\nupdatedAt: \${m.updatedAt}\\n---\\n\\n\`;
    for(const s of skill.steps) md += \`- \${s.tool}: \${JSON.stringify(s.params)}\\n\`; return md;
  }
}
`;

// 继续接第二部分...
// setup.ts - 第二部分 (接第一部分)
// ========== 扩展工具 ==========
FILES['src/tools/web-fetch.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
export class WebFetchTool extends Tool {
  name = 'web_fetch'; description = '获取网页内容并提取文本';
  parameters = z.object({ url: z.string().url(), extractText: z.boolean().optional().default(true), timeout: z.coerce.number().int().min(1000).max(30000).optional().default(15000) });
  protected async executeCore(validatedParams: any) {
    const { url, extractText, timeout } = validatedParams;
    return safeExecute(this.name, async () => {
      const res = await fetch(url, { headers: { 'User-Agent': 'AgentKit/1.0' }, signal: AbortSignal.timeout(timeout) });
      const html = await res.text(); let output = html;
      if (extractText) { const cheerio = await import('cheerio'); const $ = cheerio.load(html); $('script, style, nav, footer').remove(); output = $('body').text().replace(/\\s+/g, ' ').trim(); }
      return { success: true, output: output.slice(0, 5000) };
    }, { timeout: timeout + 5000, maxOutput: 5000 });
  }
}
`;

FILES['src/tools/web-search.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
export class WebSearchTool extends Tool {
  name = 'web_search'; description = '通过 DuckDuckGo 搜索网页';
  parameters = z.object({ query: z.string(), maxResults: z.coerce.number().int().min(1).max(5).optional().default(3) });
  protected async executeCore(validatedParams: any) {
    const { query, maxResults } = validatedParams;
    return safeExecute(this.name, async () => {
      const { search } = await import('duckduckgo-search');
      const results: string[] = [];
      for await (const r of search(query)) { results.push(\`\${r.title}\\n\${r.link}\\n\${r.snippet}\`); if(results.length >= maxResults) break; }
      return { success: true, output: results.join('\\n\\n') || '无结果' };
    }, { timeout: 20000, maxOutput: 4000 });
  }
}
`;

FILES['src/tools/edit-file.ts'] = `
import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
export class EditFileTool extends Tool {
  name = 'edit_file'; description = '在文件中查找并替换内容';
  parameters = z.object({ filePath: z.string(), search: z.string(), replace: z.string(), isRegex: z.boolean().optional().default(false) });
  protected async executeCore(validatedParams: any) {
    const { filePath, search, replace, isRegex } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) throw new ToolError('文件不存在', this.name, { filePath });
      let content = fs.readFileSync(fullPath, 'utf8');
      const before = content;
      content = isRegex ? content.replace(new RegExp(search, 'g'), replace) : content.split(search).join(replace);
      if (content === before) return { success: true, output: '无匹配内容' };
      fs.writeFileSync(fullPath, content, 'utf8');
      return { success: true, output: \`已完成替换: \${filePath}\` };
    });
  }
}
`;

FILES['src/tools/json-query.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
export class JsonQueryTool extends Tool {
  name = 'json_query'; description = '查询 JSON 文件中的特定路径';
  parameters = z.object({ filePath: z.string(), path: z.string().optional() });
  protected async executeCore(validatedParams: any) {
    const { filePath, path: q } = validatedParams;
    return safeExecute(this.name, async () => {
      const fullPath = path.resolve(process.cwd(), filePath);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (!q) return { success: true, output: JSON.stringify(data, null, 2).slice(0, 4000) };
      const parts = q.split('.'); let cur: any = data;
      for (const p of parts) { const m = p.match(/^(\\w+)\\[(\\d+)\\]$/); if (m) { cur = cur?.[m[1]]?.[Number(m[2])]; } else { cur = cur?.[p]; } if (cur === undefined) return { success: false, output: \`路径不存在: \${q}\` }; }
      return { success: true, output: JSON.stringify(cur, null, 2).slice(0, 4000) };
    });
  }
}
`;

FILES['src/tools/git.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class GitTool extends Tool {
  name = 'git'; description = '执行 git 子命令（diff, log, status 等）';
  parameters = z.object({ subcommand: z.enum(['diff', 'log', 'status', 'branch', 'show']), args: z.array(z.string()).optional().default([]) });
  protected async executeCore(validatedParams: any) {
    const { subcommand, args = [] } = validatedParams;
    return safeExecute(this.name, async () => {
      const { stdout } = await execFileAsync('git', [subcommand, ...args], { timeout: 30000, maxBuffer: 5*1024*1024, cwd: process.cwd() });
      return { success: true, output: stdout.slice(0, 5000) };
    }, { timeout: 35000, maxOutput: 5000 });
  }
}
`;

FILES['src/tools/notification.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
export class NotificationTool extends Tool {
  name = 'send_notification'; description = '发送桌面通知';
  parameters = z.object({ title: z.string(), message: z.string() });
  protected async executeCore(validatedParams: any) {
    const { title, message } = validatedParams;
    const platform = process.platform; let cmd: string, args: string[];
    if (platform === 'darwin') { cmd = 'osascript'; args = ['-e', \`display notification "\${message}" with title "\${title}"\`]; }
    else if (platform === 'linux') { cmd = 'notify-send'; args = [title, message]; }
    else return { success: false, output: '不支持的操作系统' };
    return safeExecute(this.name, async () => { await execFileAsync(cmd, args, { timeout: 5000 }); return { success: true, output: '通知已发送' }; });
  }
}
`;

FILES['src/tools/archive.ts'] = `
import { Tool, safeExecute } from '../core/tool';
import { z } from 'zod';
import fs from 'fs'; import path from 'path';
import AdmZip from 'adm-zip';
export class ArchiveTool extends Tool {
  name = 'archive'; description = '压缩/解压 zip 文件';
  parameters = z.object({ action: z.enum(['compress', 'decompress']), source: z.string(), target: z.string() });
  protected async executeCore(validatedParams: any) {
    const { action, source, target } = validatedParams;
    const src = path.resolve(process.cwd(), source); const tgt = path.resolve(process.cwd(), target);
    return safeExecute(this.name, async () => {
      if (action === 'compress') { const zip = new AdmZip(); if (fs.statSync(src).isDirectory()) zip.addLocalFolder(src); else zip.addLocalFile(src); zip.writeZip(tgt); return { success: true, output: \`已压缩至 \${target}\` }; }
      else { const zip = new AdmZip(src); zip.extractAllTo(tgt, true); return { success: true, output: \`已解压至 \${target}\` }; }
    }, { timeout: 60000, maxOutput: 2000 });
  }
}
`;

// ========== 安全机制 ==========
FILES['src/security/input-filter.ts'] = `
const THREAT_PATTERNS = [
  /ignore (all )?(previous|above) (instructions?|prompts?)/i,
  /forget (all )?(previous|above|your) (instructions?|prompts?|rules?)/i,
  /pretend (you are|to be)/i,
  /system:\\s*you are now/i,
  /DAN mode/i,
  /developer mode/i,
  /\\b(SELECT|DROP|INSERT|DELETE|UPDATE|ALTER)\\b.*\\b(FROM|TABLE)\\b/i,
  /'.*--/,
  /\\$\\(.*\\)/,
  /\`.*\`/,
  /\\|\\s*(sh|bash|curl|wget)/,
];
const SAFE_MAX_LENGTH = 32000;
export function filterInput(input: string): { safe: boolean; threatLevel: 0|1|2|3; warnings: string[]; sanitized: string } {
  if (input.length > SAFE_MAX_LENGTH) return { safe: false, threatLevel: 3, warnings: ['输入过长'], sanitized: input.slice(0, SAFE_MAX_LENGTH) };
  const warnings: string[] = []; let level: 0|1|2|3 = 0;
  for (const p of THREAT_PATTERNS) { if (p.test(input)) { warnings.push(\`威胁: \${p.source}\`); level = Math.max(level, 2) as any; } }
  const sanitized = input.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').replace(/\\n{3,}/g, '\\n\\n');
  return { safe: level < 3, threatLevel: level, warnings, sanitized };
}
`;

FILES['src/security/output-auditor.ts'] = `
const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY_REDACTED]'],
  [/\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b/g, '[EMAIL_REDACTED]'],
  [/\\b\\d{15,19}\\b/g, '[CARD_REDACTED]'],
  [/\\b\\d{6}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{6}\\b/g, '[ID_REDACTED]'],
  [/password\\s*[:=]\\s*\\S+/gi, 'password=***'],
  [/Bearer\\s+[a-zA-Z0-9\\-._~+/]+/g, 'Bearer [TOKEN_REDACTED]'],
];
export function sanitizeOutput(text: string): string { let s = text; for (const [p, r] of SENSITIVE_PATTERNS) s = s.replace(p, r); return s; }
`;

FILES['src/security/audit-logger.ts'] = `
import { appendAuditLog } from '../utils/logger';
export async function recordAudit(entry: { level: string; actor: string; operation: string; params: any; result: string; reason?: string }) { appendAuditLog({ ...entry, timestamp: new Date().toISOString() }, '.agent/audit.jsonl'); }
`;

FILES['src/security/crypto.ts'] = `
import CryptoJS from 'crypto-js';
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || CryptoJS.lib.WordArray.random(32).toString();
export function encryptApiKey(plain: string): string { return CryptoJS.AES.encrypt(plain, MASTER_KEY).toString(); }
export function decryptApiKey(cipher: string): string { return CryptoJS.AES.decrypt(cipher, MASTER_KEY).toString(CryptoJS.enc.Utf8); }
export function generateApiKey(): string { return \`ak-\${CryptoJS.lib.WordArray.random(32).toString()}\`; }
`;

FILES['src/security/key-store.ts'] = `
import { Database } from 'bun:sqlite';
import { encryptApiKey, decryptApiKey } from './crypto';
export class ApiKeyStore {
  private db: Database;
  constructor(path='.agent/apikeys.db') { this.db = new Database(path); this.init(); }
  private init() { this.db.run('CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, masked TEXT NOT NULL, encrypted TEXT NOT NULL, created_at TEXT DEFAULT (datetime(\\'now\\')), last_used TEXT)'); }
  store(name: string, plain: string) { const id = crypto.randomUUID(); const masked = plain.slice(0,4)+'...'+plain.slice(-4); const enc = encryptApiKey(plain); this.db.run('INSERT INTO api_keys (id,name,masked,encrypted) VALUES (?,?,?,?)', [id,name,masked,enc]); return {id,name,masked,encrypted:enc,createdAt:new Date().toISOString()}; }
  getDecrypted(id: string): string | null { const row = this.db.query('SELECT encrypted FROM api_keys WHERE id=?').get(id) as any; if(!row) return null; this.db.run('UPDATE api_keys SET last_used=datetime(\\'now\\') WHERE id=?', [id]); return decryptApiKey(row.encrypted); }
  list() { const rows = this.db.query('SELECT id,name,masked,created_at,last_used FROM api_keys ORDER BY created_at DESC').all() as any[]; return rows.map((r:any)=>({id:r.id,name:r.name,masked:r.masked,encrypted:'',createdAt:r.created_at,lastUsed:r.last_used})); }
  delete(id: string) { return this.db.run('DELETE FROM api_keys WHERE id=?', [id]).changes > 0; }
}
`;

// ========== 技能蒸馏工具 ==========

// 工具索引更新
FILES['src/tools/index.ts'] = `
export { ReadFileTool } from './read-file';
export { WriteFileTool } from './write-file';
export { BashTool } from './bash';
export { GrepTool } from './grep';
export { GlobTool } from './glob';
export { WebFetchTool } from './web-fetch';
export { WebSearchTool } from './web-search';
export { EditFileTool } from './edit-file';
export { JsonQueryTool } from './json-query';
export { GitTool } from './git';
export { NotificationTool } from './notification';
export { ArchiveTool } from './archive';
export { SkillDistillerTool } from './skill-distiller';
`;

// setup.ts - 第三部分 (接第二部分)
// ========== IM 集成 ==========
FILES['src/im/types.ts'] = `export interface IMChatMessage { userId: string; userName: string; content: string; channel: 'wecom'|'dingtalk'|'feishu'; raw: any; conversationId?: string; }
export interface IMResponse { text: string; atUser?: string; }`;

FILES['src/im/adapter.ts'] = `import { IMChatMessage, IMResponse } from './types';
export interface IMAdapter {
  verifySignature(rawBody: string, headers: Record<string, any>): boolean;
  parseMessage(rawBody: any): IMChatMessage;
  sendMessage(message: IMChatMessage, response: IMResponse): Promise<void>;
  platform: 'wecom'|'dingtalk'|'feishu';
}`;

FILES['src/im/wecom-adapter.ts'] = `
import crypto from 'crypto'; import axios from 'axios'; import { IMAdapter } from './adapter'; import { IMChatMessage, IMResponse } from './types';
export class WeComAdapter implements IMAdapter {
  platform = 'wecom' as const; private token: string; private aesKey: string; private webhook?: string;
  constructor(config: { token: string; encodingAESKey: string; corpId?: string; webhookUrl?: string }) { this.token=config.token; this.aesKey=config.encodingAESKey; this.webhook=config.webhookUrl; }
  verifySignature(rawBody: string, headers: any): boolean {
    const sign = headers['x-wework-signature']||'', ts = headers['x-wework-timestamp']||'', nonce = headers['x-wework-nonce']||'';
    const arr = [this.token, ts, nonce, rawBody].sort().join(''); return crypto.createHash('sha1').update(arr).digest('hex') === sign;
  }
  parseMessage(rawBody: any): IMChatMessage { const m = typeof rawBody==='string'?JSON.parse(rawBody):rawBody; return { userId: m.From?.UserId||m.UserID||'unknown', userName: m.From?.Name||'用户', content: m.Text?.Content||'', channel: 'wecom', raw: m, conversationId: m.ChatId }; }
  async sendMessage(msg: IMChatMessage, res: IMResponse) { if(!this.webhook) return; await axios.post(this.webhook, { msgtype:'text', text:{ content: res.text, mentioned_list: res.atUser?[res.atUser]:[] } }); }
}`;

FILES['src/im/dingtalk-adapter.ts'] = `
import crypto from 'crypto'; import axios from 'axios'; import { IMAdapter } from './adapter'; import { IMChatMessage, IMResponse } from './types';
export class DingTalkAdapter implements IMAdapter {
  platform = 'dingtalk' as const; private secret: string; private webhook?: string;
  constructor(config: { appSecret: string; webhookUrl?: string }) { this.secret=config.appSecret; this.webhook=config.webhookUrl; }
  verifySignature(rawBody: string, headers: any): boolean { const ts=headers.timestamp||'', sign=headers.sign||''; const comp = crypto.createHmac('sha256', this.secret).update(ts+'\\n'+this.secret).digest('base64'); return sign===comp; }
  parseMessage(rawBody: any): IMChatMessage { const m = typeof rawBody==='string'?JSON.parse(rawBody):rawBody; return { userId: m.senderId||'unknown', userName: m.senderNick||'用户', content: m.text?.content||'', channel:'dingtalk', raw:m, conversationId: m.conversationId }; }
  async sendMessage(msg: IMChatMessage, res: IMResponse) { if(!this.webhook) return; await axios.post(this.webhook, { msgtype:'text', text:{content:res.text}, at: res.atUser?{atUserIds:[res.atUser]}:undefined }); }
}`;

FILES['src/im/feishu-adapter.ts'] = `
import crypto from 'crypto'; import axios from 'axios'; import { IMAdapter } from './adapter'; import { IMChatMessage, IMResponse } from './types';
export class FeishuAdapter implements IMAdapter {
  platform = 'feishu' as const; private secret: string; private webhook?: string;
  constructor(config: { appSecret: string; webhookUrl?: string }) { this.secret=config.appSecret; this.webhook=config.webhookUrl; }
  verifySignature(rawBody: string, headers: any): boolean { const ts=headers['x-lark-request-timestamp']||'', nonce=headers['x-lark-request-nonce']||'', sign=headers['x-lark-signature']||''; const comp = crypto.createHmac('sha256', this.secret).update(ts+nonce+rawBody).digest('base64'); return sign===comp; }
  parseMessage(rawBody: any): IMChatMessage { const m = typeof rawBody==='string'?JSON.parse(rawBody):rawBody; const e = m.event||m; return { userId: e.sender?.sender_id?.open_id||'unknown', userName:'飞书用户', content: e.message?.content||e.text||'', channel:'feishu', raw:m, conversationId: e.message?.chat_id }; }
  async sendMessage(msg: IMChatMessage, res: IMResponse) { if(!this.webhook) return; await axios.post(this.webhook, { msg_type:'text', content:{ text:res.text } }); }
}`;

// IM 网关
FILES['server/im/gateway.ts'] = `
import { Hono } from 'hono'; import { IMAdapter } from '../../src/im/adapter'; import { AgentLoop } from '../../src/core/agent-loop'; // 假设 createAgent 可用
export const imRouter = new Hono(); const adapters = new Map<string, IMAdapter>();
export function registerAdapter(name: string, adapter: IMAdapter) { adapters.set(name, adapter); }
imRouter.post('/webhook/:platform', async (c) => {
  const platform = c.req.param('platform'); const adapter = adapters.get(platform); if(!adapter) return c.text('Unknown', 404);
  const rawBody = await c.req.text(); const headers = Object.fromEntries(c.req.raw.headers.entries());
  if(!adapter.verifySignature(rawBody, headers)) return c.text('Signature failed', 403);
  const msg = adapter.parseMessage(rawBody);
  // 需要外部注入 createAgent 函数
  const agent = (c as any).createAgent?.(msg.userId); if(!agent) return c.text('Agent not available', 500);
  const reply = await agent.run(msg.content);
  await adapter.sendMessage(msg, { text: reply });
  return c.text('OK');
});
`;

// ========== 高并发支撑 ==========
FILES['src/storage/redis-session-store.ts'] = `
import Redis from 'ioredis';
export class RedisSessionStore {
  constructor(private redis = new Redis()) {}
  async saveMessages(sessionId: string, messages: any[]) { await this.redis.setex('session:'+sessionId+':messages', 3600, JSON.stringify(messages)); }
  async getMessages(sessionId: string): Promise<any[]> { const d = await this.redis.get('session:'+sessionId+':messages'); return d ? JSON.parse(d) : []; }
  async appendMessage(sessionId: string, msg: any) { const msgs = await this.getMessages(sessionId); msgs.push(msg); await this.saveMessages(sessionId, msgs); }
}
`;

FILES['src/llm/openai-pool.ts'] = `
import OpenAI from 'openai';
class OpenAIPool {
  private clients = new Map<string, OpenAI>();
  getClient(apiKey: string, baseURL?: string): OpenAI {
    const key = apiKey+':'+(baseURL||'');
    if (!this.clients.has(key)) this.clients.set(key, new OpenAI({ apiKey, baseURL, timeout: 60000, maxRetries: 2 }));
    return this.clients.get(key)!;
  }
}
export const llmPool = new OpenAIPool();
`;

FILES['src/utils/request-coalescer.ts'] = `
export class RequestCoalescer {
  private pending = new Map<string, Promise<string>>();
  async coalesce(key: string, fn: () => Promise<string>): Promise<string> {
    if (this.pending.has(key)) return this.pending.get(key)!;
    const p = fn().finally(() => this.pending.delete(key)); this.pending.set(key, p); return p;
  }
}
export const coalescer = new RequestCoalescer();
`;

FILES['src/utils/cache.ts'] = `
export class MemoryCache {
  private store = new Map<string, { value: any; expiry: number }>();
  set(key: string, value: any, ttlMs = 60000) { this.store.set(key, { value, expiry: Date.now() + ttlMs }); }
  get(key: string): any | null { const item = this.store.get(key); if (!item || Date.now() > item.expiry) { this.store.delete(key); return null; } return item.value; }
}
export const cache = new MemoryCache();
`;

FILES['src/middleware/rate-limit.ts'] = `
import { Redis } from 'ioredis'; const redis = new Redis();
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> { const cnt = await redis.incr(key); if(cnt===1) await redis.expire(key, windowSec); return cnt <= max; }
`;

// ========== Agent 循环精简版 ==========
FILES['src/core/agent-loop.ts'] = `
import OpenAI from 'openai';
import { z } from 'zod';
import { AgentState } from './state';
import type { AgentConfig } from '../types/config';
import type { Message, ToolCall } from '../types/message';
import { PolicyResult } from './policy';
import { AgentEventBus } from './events';
import { tokenCount } from '../context/token-counter';
import { retryWithBackoff } from '../utils/retry';
import { sanitizeOutput } from '../security/output-auditor';
function zodToJsonSchema(schema: z.ZodTypeAny): any { /* 同上 */ return { type: 'object', properties: {} }; }
export type ConfirmRequest = { sessionId: string; toolCallId: string; toolName: string; args: any; diff: string; };
export class AgentLoop {
  private state: AgentState; private openai: OpenAI; public sessionId: string; private eventBus = AgentEventBus.getInstance();
  private skillManager?: any; private knowledgeBase?: any;
  constructor(private config: AgentConfig, sessionId='default') {
    this.sessionId = sessionId; this.state = new AgentState();
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY; if(!apiKey) throw new Error('Missing API Key');
    this.openai = new OpenAI({ apiKey, baseURL: config.baseURL || process.env.OPENAI_BASE_URL, timeout: 120000, maxRetries: 2 });
    this.skillManager = (config as any).skillManager; this.knowledgeBase = (config as any).knowledgeBase;
  }
  async run(userInput: string, signal?: AbortSignal): Promise<string> {
    this.state.addMessage({ role: 'user', content: userInput });
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      let messages = await this.config.contextMgr.compress(this.state.messages);
      const memories = await this.config.memory.getAll();
      messages = this.config.contextMgr.injectSystemPrompt(messages, memories, '');
      // 注入技能和知识
      if (this.skillManager) { try { const ctx = await this.skillManager.searchRelevantSkills(userInput, 3); if (ctx) messages.push({ role: 'system', content: ctx }); } catch {} }
      if (this.knowledgeBase) { try { const ctx = await this.knowledgeBase.retrieve(userInput, 3); if (ctx) messages.push({ role: 'system', content: ctx }); } catch {} }
      const toolsDef = this.config.tools.map((t: any) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: zodToJsonSchema(t.parameters) } }));
      let response; try {
        response = await retryWithBackoff(() => this.openai.chat.completions.create({ model: this.config.model, messages: messages as any, tools: toolsDef, tool_choice: 'auto' }, { signal }), { maxRetries: 2 });
      } catch (e: any) { this.eventBus.emit('message-'+this.sessionId, { type: 'error', content: e.message }); return 'API 错误: ' + e.message; }
      const choice = response.choices[0]; const assistantMsg = choice.message;
      if (assistantMsg.content && !assistantMsg.tool_calls) { this.state.addMessage({ role: 'assistant', content: assistantMsg.content }); this.eventBus.emit('message-'+this.sessionId, { type: 'final', content: assistantMsg.content }); return assistantMsg.content; }
      if (assistantMsg.tool_calls) {
        const tcs: ToolCall[] = assistantMsg.tool_calls.map((tc: any) => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } }));
        this.state.addMessage({ role: 'assistant', content: assistantMsg.content, tool_calls: tcs });
        for (const tc of tcs) {
          const tool = this.config.tools.find((t: any) => t.name === tc.function.name); let args: any; try { args = JSON.parse(tc.function.arguments); } catch { continue; }
          this.eventBus.emit('message-'+this.sessionId, { type: 'tool-start', toolName: tool?.name || tc.function.name, args: tc.function.arguments });
          if (!tool) { this.state.addMessage({ role: 'tool', content: '工具未找到', tool_call_id: tc.id }); continue; }
          let policyResult: PolicyResult; try { policyResult = await this.config.policy.preExecute(tool, args); } catch (e: any) { continue; }
          if (!policyResult.allowed) { this.state.addMessage({ role: 'tool', content: policyResult.reason || '被拦截', tool_call_id: tc.id }); continue; }
          if (policyResult.needApproval && policyResult.diff) { const approved = await this.waitForConfirm({ sessionId: this.sessionId, toolCallId: tc.id, toolName: tool.name, args, diff: policyResult.diff }); if (!approved) { this.state.addMessage({ role: 'tool', content: '用户拒绝', tool_call_id: tc.id }); continue; } }
          try { const result = await tool.execute(args); this.state.addMessage({ role: 'tool', content: sanitizeOutput(result.output), tool_call_id: tc.id }); this.eventBus.emit('message-'+this.sessionId, { type: 'tool-end', toolName: tool.name, status: result.success ? 'done' : 'error', result: result.output }); } catch (e: any) { this.state.addMessage({ role: 'tool', content: e.message, tool_call_id: tc.id }); }
        }
        continue;
      }
    }
    return '达到最大迭代次数';
  }
  private waitForConfirm(req: ConfirmRequest): Promise<boolean> {
    return new Promise(resolve => { const t = setTimeout(() => { this.eventBus.off('confirm-response', h); resolve(false); }, 30000);
      const h = (data: any) => { if (data.sessionId === this.sessionId) { clearTimeout(t); this.eventBus.off('confirm-response', h); resolve(data.approved); } };
      this.eventBus.on('confirm-response', h); this.eventBus.emit('confirm-request', req); });
  }
}
`;

// ========== 重试工具 ==========
FILES['src/utils/retry.ts'] = `
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: { maxRetries?: number; initialDelayMs?: number } = {}): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000 } = options; let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) { try { return await fn(); } catch (e: any) { lastErr = e; if (i < maxRetries) await new Promise(r => setTimeout(r, initialDelayMs * Math.pow(2, i))); } }
  throw lastErr;
}
`;

// ========== 服务器 ==========
FILES['server/api.ts'] = `
import { Hono } from 'hono'; import { AgentLoop } from '../src/core/agent-loop'; import { ReadFileTool, WriteFileTool, BashTool, GrepTool, GlobTool, WebFetchTool, WebSearchTool, EditFileTool, JsonQueryTool, GitTool, NotificationTool, ArchiveTool } from '../src/tools'; import { FileMemory } from '../src/memory/file-memory'; import { SlidingWindowContextManager } from '../src/context/sliding-window'; import { DiffUndoPolicy } from '../src/policy/diff-undo-policy'; import { SkillManager } from '../src/skills/skill-manager'; import { FileVectorStore } from '../src/vector/file-vector-store'; import { SkillDistillerTool } from '../src/tools/skill-distiller'; import { ApiKeyStore } from '../src/security/key-store'; import { CronStore } from '../src/cron/cron-store'; import { CronScheduler } from '../src/cron/cron-scheduler'; import { AgentEventBus } from '../src/core/events'; import OpenAI from 'openai';
const app = new Hono(); const eventBus = AgentEventBus.getInstance(); const sessions = new Map<string, AgentLoop>();
const vectorStore = new FileVectorStore('.agent'); const skillManager = new SkillManager('.agent/skills', vectorStore);
const keyStore = new ApiKeyStore('.agent/apikeys.db'); const cronStore = new CronStore('.agent/cron.db'); const scheduler = new CronScheduler(cronStore);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
function createAgent(sessionId: string, overrides: any = {}) {
  const config = {
    model: overrides.model || 'gpt-4o', apiKey: overrides.apiKey || process.env.OPENAI_API_KEY, baseURL: overrides.baseURL || process.env.OPENAI_BASE_URL,
    tools: [new ReadFileTool(), new WriteFileTool(), new BashTool(), new GrepTool(), new GlobTool(), new WebFetchTool(), new WebSearchTool(), new EditFileTool(), new JsonQueryTool(), new GitTool(), new NotificationTool(), new ArchiveTool(), new SkillDistillerTool(skillManager, openai)],
    memory: new FileMemory({ path: \`.agent/\${sessionId}_memory.json\` }), contextMgr: new SlidingWindowContextManager({ maxTokens: 8000, keepRecentTurns: 6, compressionThreshold: 0.9 }),
    policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }), maxIterations: 15, skillManager,
  };
  const agent = new AgentLoop(config, sessionId); sessions.set(sessionId, agent); return agent;
}
app.get('/api/stream/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId'); const input = c.req.query('input'); if (!input) return c.text('Missing', 400);
  const model = c.req.query('model') || 'gpt-4o'; const apiKey = c.req.query('apiKey') || process.env.OPENAI_API_KEY; const baseURL = c.req.query('baseURL') || process.env.OPENAI_BASE_URL;
  const agent = createAgent(sessionId, { model, apiKey, baseURL });
  let closed = false; const stream = new ReadableStream({ start(controller) {
    const send = (data: any) => { if(!closed) { try { controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(data)+'\\n\\n')); } catch {} } };
    const handler = (data: any) => { if (data.sessionId === sessionId || data.type) send(data); };
    eventBus.on('confirm-request', handler); eventBus.on('message-'+sessionId, handler);
    agent.run(input).then(final => send({ type: 'final', content: final })).catch(e => send({ type: 'error', content: e.message })).finally(() => { eventBus.off('confirm-request', handler); eventBus.off('message-'+sessionId, handler); closed = true; try{ controller.close(); } catch {} });
  }});
  return c.newResponse(stream, { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
});
app.post('/api/confirm', async (c) => { const { sessionId, approved } = await c.req.json(); eventBus.emit('confirm-response', { sessionId, approved }); return c.json({ ok: true }); });
// Cron, Keys, Skills, IM 等路由将在 main.ts 中挂载
export { app, createAgent, keyStore, cronStore, scheduler, skillManager };
`;

FILES['server/main.ts'] = `
import 'dotenv/config'; import { app, keyStore, cronStore, scheduler, skillManager } from './api'; import { serveStatic } from 'hono/bun'; import { imRouter, registerAdapter } from './im/gateway'; import { WeComAdapter } from '../src/im/wecom-adapter'; import { DingTalkAdapter } from '../src/im/dingtalk-adapter'; import { FeishuAdapter } from '../src/im/feishu-adapter';
// 注册 IM 适配器
if (process.env.WECOM_TOKEN) registerAdapter('wecom', new WeComAdapter({ token: process.env.WECOM_TOKEN, encodingAESKey: process.env.WECOM_ENCODING_AES_KEY!, corpId: process.env.WECOM_CORP_ID, webhookUrl: process.env.WECOM_WEBHOOK_URL }));
if (process.env.DINGTALK_APP_SECRET) registerAdapter('dingtalk', new DingTalkAdapter({ appSecret: process.env.DINGTALK_APP_SECRET, webhookUrl: process.env.DINGTALK_WEBHOOK_URL }));
if (process.env.FEISHU_APP_SECRET) registerAdapter('feishu', new FeishuAdapter({ appSecret: process.env.FEISHU_APP_SECRET, webhookUrl: process.env.FEISHU_WEBHOOK_URL }));
// 挂载路由
app.route('/im', imRouter);
// Cron API
app.get('/api/cron', async (c) => c.json(await cronStore.list()));
app.post('/api/cron', async (c) => { const body = await c.req.json(); const job = await cronStore.create(body); scheduler.scheduleJob(job); return c.json(job); });
app.put('/api/cron/:id', async (c) => { const id = c.req.param('id'); const body = await c.req.json(); const updated = await cronStore.update(id, body); if(updated) scheduler.scheduleJob(updated); return c.json(updated); });
app.delete('/api/cron/:id', async (c) => { await cronStore.delete(c.req.param('id')); return c.json({ok:true}); });
// Keys API
app.get('/api/keys', (c) => c.json(keyStore.list()));
app.post('/api/keys', async (c) => { const { name, plainKey } = await c.req.json(); if(!plainKey) return c.json({error:'Missing'},400); const record = keyStore.store(name, plainKey); return c.json(record); });
app.delete('/api/keys/:id', (c) => { keyStore.delete(c.req.param('id')); return c.json({ok:true}); });
// Skills API
app.get('/api/skills', (c) => c.json(skillManager.listSkills().map(s=>({name:s.metadata.name,title:s.metadata.title,description:s.metadata.description,tags:s.metadata.tags,stepCount:s.steps.length}))));
app.delete('/api/skills/:name', (c) => { skillManager.deleteSkill(c.req.param('name')); return c.json({ok:true}); });
// 静态文件 & 启动
app.use('/public/*', serveStatic({ root: './' })); app.get('/', (c) => c.redirect('/public/index.html'));
console.log('🚀 服务启动: http://localhost:3000'); scheduler.start();
export default { port: 3000, fetch: app.fetch, idleTimeout: 120 };
`;

// setup.ts - 第四部分 (接第三部分)
// ========== 前端关键页面 ==========
FILES['web/src/components/ModelSettings.tsx'] = `
import { useState } from 'react'; import { Modal, Form, Select, Input, InputNumber, Button, Space, Divider, message, Tooltip } from 'antd'; import { SettingOutlined, CloudOutlined, HomeOutlined } from '@ant-design/icons'; import { loadModelConfig, saveModelConfig, ModelConfig } from '../types/models';
const PRESET_MODELS = [
  { label: 'GPT-4o', value: 'gpt-4o', provider: 'openai' }, { label: 'GPT-4o-mini', value: 'gpt-4o-mini', provider: 'openai' },
  { label: 'Qwen2.5 14B', value: 'qwen2.5:14b', provider: 'ollama' }, { label: 'Llama3.1 8B', value: 'llama3.1:8b', provider: 'ollama' },
  { label: 'Mistral-Nemo 12B', value: 'mistral-nemo:12b', provider: 'ollama' },
];
export default function ModelSettings({ onConfigChange }: { onConfigChange?: (c: ModelConfig) => void }) {
  const [open, setOpen] = useState(false); const [form] = Form.useForm(); const [provider, setProvider] = useState('openai');
  const openModal = () => { const cfg = loadModelConfig(); form.setFieldsValue(cfg); setProvider(cfg.baseURL?.includes('11434')?'ollama':'openai'); setOpen(true); };
  const switchProvider = (p: string) => { setProvider(p); form.setFieldsValue({ baseURL: p==='ollama'?'http://localhost:11434/v1':'' }); };
  const save = () => form.validateFields().then(v => { const c: ModelConfig = { model:v.model, apiKey:v.apiKey, baseURL:v.baseURL, temperature:v.temperature, maxTokens:v.maxTokens }; saveModelConfig(c); message.success('已切换至 '+v.model); setOpen(false); onConfigChange?.(c); });
  return (<><Tooltip title="模型配置"><Button type="text" icon={<SettingOutlined/>} onClick={openModal}/></Tooltip><Modal title="模型切换" open={open} onCancel={()=>setOpen(false)} onOk={save} okText="应用"><Form form={form} layout="vertical" initialValues={loadModelConfig()}>
    <Form.Item label="提供商"><Space><Button type={provider==='openai'?'primary':'default'} icon={<CloudOutlined/>} onClick={()=>switchProvider('openai')}>云端</Button><Button type={provider==='ollama'?'primary':'default'} icon={<HomeOutlined/>} onClick={()=>switchProvider('ollama')}>本地</Button></Space></Form.Item>
    <Form.Item name="model" label="模型" rules={[{required:true}]}><Select showSearch placeholder="选择模型" optionFilterProp="label" allowClear>{PRESET_MODELS.filter(m=>m.provider===provider).map(m=>(<Select.Option key={m.value} value={m.value}><Space>{m.label}<Tag color={m.provider==='ollama'?'green':'blue'}>{m.provider==='ollama'?'本地':'云端'}</Tag></Space></Select.Option>))}</Select></Form.Item>
    <Form.Item name="baseURL" label="Base URL"><Input placeholder={provider==='ollama'?'http://localhost:11434/v1':'https://api.openai.com/v1'}/></Form.Item>
    <Form.Item name="apiKey" label="API Key"><Input.Password placeholder="sk-..."/></Form.Item>
    <Space><Form.Item name="temperature" label="温度" rules={[{required:true}]}><InputNumber min={0} max={2} step={0.1}/></Form.Item><Form.Item name="maxTokens" label="最大Tokens" rules={[{required:true}]}><InputNumber min={100} max={128000} step={100}/></Form.Item></Space>
  </Form></Modal></>); }
`;

FILES['web/src/pages/ApiKeysPage.tsx'] = `
import { useState, useEffect } from 'react'; import { Table, Button, Modal, Input, Form, Popconfirm, Space, Tag, message } from 'antd'; import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [modal, setModal] = useState(false); const [form] = Form.useForm();
  const fetch = async () => { setLoading(true); try { const r = await fetch('/api/keys'); setKeys(await r.json()); } catch {} finally { setLoading(false); } };
  useEffect(() => { fetch(); }, []);
  const create = async (v: any) => { await fetch('/api/keys', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) }); message.success('创建成功'); setModal(false); form.resetFields(); fetch(); };
  const del = async (id: string) => { await fetch('/api/keys/'+id, { method:'DELETE' }); fetch(); };
  const cols = [ { title:'名称', dataIndex:'name' }, { title:'Key', dataIndex:'masked', render: (v:string)=><Tag>{v}</Tag> }, { title:'创建时间', dataIndex:'createdAt', render: (v:string)=>new Date(v).toLocaleString() }, { title:'操作', render: (_:any, r:any)=><Space><Popconfirm title="删除？" onConfirm={()=>del(r.id)}><Button size="small" danger icon={<DeleteOutlined/>}/></Popconfirm></Space> } ];
  return <div style={{padding:24}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}><h3>🔑 API Keys</h3><Button type="primary" icon={<PlusOutlined/>} onClick={()=>setModal(true)}>新建</Button></div><Table dataSource={keys} columns={cols} rowKey="id" loading={loading}/>
    <Modal title="新建 Key" open={modal} onCancel={()=>setModal(false)} onOk={()=>form.submit()}><Form form={form} layout="vertical" onFinish={create}><Form.Item name="name" label="名称" rules={[{required:true}]}><Input placeholder="如：我的 Key"/></Form.Item><Form.Item name="plainKey" label="API Key" rules={[{required:true}]}><Input.Password placeholder="sk-..."/></Form.Item></Form></Modal></div>;
}
`;

FILES['web/src/pages/CronPage.tsx'] = `
import { useState, useEffect } from 'react'; import { Table, Button, Modal, Form, Input, Select, Switch, Popconfirm, Space, Tag, message } from 'antd'; import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
export default function CronPage() {
  const [jobs, setJobs] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [modalOpen, setModalOpen] = useState(false); const [editing, setEditing] = useState<any>(null); const [form] = Form.useForm();
  const fetch = async () => { setLoading(true); try { const r = await fetch('/api/cron'); setJobs(await r.json()); } catch {} finally { setLoading(false); } };
  useEffect(()=>{fetch();}, []);
  const submit = async (v: any) => { const url = editing ? '/api/cron/'+editing.id : '/api/cron'; const method = editing ? 'PUT' : 'POST'; await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) }); message.success(editing?'更新成功':'创建成功'); setModalOpen(false); setEditing(null); form.resetFields(); fetch(); };
  const del = async (id: string) => { await fetch('/api/cron/'+id, { method:'DELETE' }); fetch(); };
  const runNow = async (id: string) => { await fetch('/api/cron/'+id+'/run', { method:'POST' }); message.success('已触发'); };
  const toggle = async (id: string, enabled: boolean) => { await fetch('/api/cron/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled }) }); fetch(); };
  const cols = [ { title:'名称', dataIndex:'name' }, { title:'Cron', dataIndex:'cronExpression', render: (v:string)=><Tag color="blue">{v}</Tag> }, { title:'提示词', dataIndex:'prompt', ellipsis:true }, { title:'状态', dataIndex:'enabled', render: (v:boolean, r:any)=><Switch checked={v} onChange={(c)=>toggle(r.id,c)}/> }, { title:'上次执行', dataIndex:'lastRun', render: (v?:string)=>v?new Date(v).toLocaleString():'-' }, { title:'操作', render: (_:any, r:any)=><Space><Button size="small" icon={<ThunderboltOutlined/>} onClick={()=>runNow(r.id)}>立即执行</Button><Button size="small" icon={<EditOutlined/>} onClick={()=>{setEditing(r); form.setFieldsValue(r); setModalOpen(true);}}/><Popconfirm title="删除？" onConfirm={()=>del(r.id)}><Button size="small" danger icon={<DeleteOutlined/>}/></Popconfirm></Space> } ];
  return <div style={{padding:24}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}><h3>⏰ 定时任务</h3><Button type="primary" icon={<PlusOutlined/>} onClick={()=>{setEditing(null); form.resetFields(); setModalOpen(true);}}>新建任务</Button></div><Table dataSource={jobs} columns={cols} rowKey="id" loading={loading}/>
    <Modal title={editing?'编辑':'新建'} open={modalOpen} onCancel={()=>setModalOpen(false)} onOk={()=>form.submit()} width={560}><Form form={form} layout="vertical" onFinish={submit}>
      <Form.Item name="name" label="名称" rules={[{required:true}]}><Input/></Form.Item>
      <Form.Item name="description" label="描述"><Input.TextArea rows={2}/></Form.Item>
      <Form.Item name="cronExpression" label="Cron 表达式" rules={[{required:true}]} help="如 0 9 * * 1-5"><Input/></Form.Item>
      <Form.Item name="prompt" label="提示词" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item>
      <Form.Item name="role" label="角色"><Select allowClear placeholder="可选"><Select.Option value="programmer">程序员</Select.Option></Select></Form.Item>
    </Form></Modal></div>;
}
`;

FILES['web/src/pages/LogsPage.tsx'] = `
import { useState, useEffect, useRef } from 'react'; import { Table, Tag, Select, Switch, Typography, Space } from 'antd';
export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]); const [filter, setFilter] = useState<string[]>(['info','warn','error']); const [paused, setPaused] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const es = new EventSource('/api/logs/stream'); es.onmessage = e => { try { const d = JSON.parse(e.data); setLogs(prev => [...prev.slice(-500), d]); } catch {} }; return () => es.close(); }, []);
  useEffect(() => { if (!paused && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs, paused]);
  const levelColor: Record<string,string> = { info:'blue', warn:'orange', error:'red', debug:'default' };
  const cols = [ { title:'时间', dataIndex:'timestamp', width:180, render: (v:string)=>new Date(v).toLocaleTimeString() }, { title:'级别', dataIndex:'level', width:70, render: (v:string)=><Tag color={levelColor[v]}>{v}</Tag> }, { title:'消息', dataIndex:'message', ellipsis:true }, { title:'会话', dataIndex:'sessionId', width:120, ellipsis:true }, { title:'工具', dataIndex:'toolName', width:100 }, { title:'耗时/Tokens', key:'meta', width:120, render: (_:any, r:any)=><Space>{r.duration && <span>{r.duration}ms</span>}{r.tokensUsed && <Tag>{r.tokensUsed} tokens</Tag>}</Space> } ];
  return <div style={{padding:16, display:'flex', flexDirection:'column', height:'100%'}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}><Typography.Title level={4} style={{margin:0}}>📋 实时日志</Typography.Title><Space><Select mode="multiple" value={filter} onChange={setFilter} options={[{label:'INFO',value:'info'},{label:'WARN',value:'warn'},{label:'ERROR',value:'error'},{label:'DEBUG',value:'debug'}]} style={{width:200}}/><span>暂停滚动</span><Switch checked={paused} onChange={setPaused}/></Space></div><div ref={ref} style={{flex:1, overflow:'auto'}}><Table dataSource={logs.filter((l:any)=>filter.includes(l.level))} columns={cols} rowKey={(_,i)=>String(i)} size="small" pagination={false} sticky/></div></div>;
}
`;

FILES['web/src/providers/chat-provider-solo.ts'] = `
import OpenAI from 'openai'; import { loadModelConfig } from '../types/models';
export async function sendMessageSolo(messages: any[], onChunk: (chunk: string) => void) {
  const cfg = loadModelConfig();
  const client = new OpenAI({ apiKey: cfg.apiKey || 'ollama', baseURL: cfg.baseURL || 'http://localhost:11434/v1', dangerouslyAllowBrowser: true });
  const stream = await client.chat.completions.create({ model: cfg.model, messages: messages.map(m=>({role:m.role, content:m.content})), stream: true });
  for await (const chunk of stream) { const text = chunk.choices[0]?.delta?.content; if (text) onChunk(text); }
}
`;

// ========== 测试 ==========
FILES['tests/integration/agent-loop.test.ts'] = `
import { describe, it, expect, mock } from 'bun:test';
mock.module('openai', () => ({ default: class { chat = { completions: { create: mock(async () => ({ choices: [{ message: { content: '模拟回复', tool_calls: undefined } }], usage: { total_tokens: 10 } })) } }; } }));
import { AgentLoop } from '../../src/core/agent-loop';
import { ReadFileTool } from '../../src/tools/read-file';
import { DefaultPolicy } from '../../src/policy/default-policy';
import { SlidingWindowContextManager } from '../../src/context/sliding-window';
import { FileMemory } from '../../src/memory/file-memory';
describe('AgentLoop', () => {
  it('简单文本交互', async () => {
    const agent = new AgentLoop({ model:'gpt-4o', apiKey:'fake', tools:[new ReadFileTool()], memory: new FileMemory({ path:'.agent/test-mem.json' }), contextMgr: new SlidingWindowContextManager({ maxTokens:8000, keepRecentTurns:6, compressionThreshold:0.9 }), policy: new DefaultPolicy(), maxIterations:2 }, 'test');
    const result = await agent.run('Hello'); expect(result).toBeString();
  });
});
`;

// ========== 部署与启动 ==========
FILES['start-cluster.ts'] = `
import { spawn } from 'bun';
let child = spawn({ cmd: ['bun', 'run', '--env-file', '.env', 'server/main.ts'], stdout: 'inherit', stderr: 'inherit' });
process.on('SIGUSR2', () => { const old = child; child = spawn({ cmd: ['bun', 'run', '--env-file', '.env', 'server/main.ts'], stdout: 'inherit', stderr: 'inherit' }); setTimeout(() => old.kill('SIGTERM'), 5000); });
`;

FILES['.env.example'] = `
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o
# 可选
ENCRYPTION_MASTER_KEY=
REDIS_HOST=localhost
REDIS_PORT=6379
WECOM_TOKEN=...
DINGTALK_APP_SECRET=...
FEISHU_APP_SECRET=...
`;

// ========== 生成文件 ==========
console.log('🚀 正在生成项目文件...');
for (const [filePath, content] of Object.entries(FILES)) {
  const fullPath = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log('✓', filePath);
}
console.log('\\n✅ 项目创建完成！接下来：');
console.log('  1. bun install');
console.log('  2. 配置 .env');
console.log('  3. bun run server/main.ts');
console.log('  4. cd web && bun install && bun run dev');