import { Policy, PolicyResult } from '../core/policy';
import fs from 'fs';
import path from 'path';
import { restoreBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath } from '../tools/workspace';
export type PermissionLevel = 'default' | 'acceptEdits' | 'bypassPermissions' | 'readOnly';
type OperationType = 'read' | 'write' | 'execute' | 'network';
const MATRIX: Record<PermissionLevel, OperationType[]> = {
  readOnly: ['read'], default: ['read','write','execute'], acceptEdits: ['read','write','execute'], bypassPermissions: ['read','write','execute','network']
};
export class DiffUndoPolicy extends Policy {
  private currentLevel: PermissionLevel = 'default';
  private opCount = new Map<string, number>();
  private MAX = 100;
  constructor(private options: { backupDir?: string; autoConfirm?: boolean; workspaceRoot?: string } = {}) {
    super();
  }
  setPermissionLevel(level: PermissionLevel) { this.currentLevel = level; this.opCount.clear(); }
  private classifyOp(toolName: string): OperationType {
    if (['read_file','grep','glob','list_skills'].includes(toolName)) return 'read';
    if (['write_file','edit_file', 'apply_patch'].includes(toolName)) return 'write';
    if (['bash','create_skill','delete_skill','run_skill','update_skill'].includes(toolName)) return 'execute';
    return 'network';
  }
  async preExecute(tool: any, params: any): Promise<PolicyResult> {
    const res = new PolicyResult();
    const op = this.classifyOp(tool.name);
    if (!MATRIX[this.currentLevel].includes(op)) { res.allowed = false; res.reason = `权限级别 ${this.currentLevel} 不允许 ${op} 操作`; return res; }
    const cnt = (this.opCount.get(tool.name) || 0) + 1; this.opCount.set(tool.name, cnt);
    if (cnt > this.MAX) { res.allowed = false; res.reason = '操作次数超限'; return res; }
    if (op === 'write' && this.currentLevel === 'default') {
      const diff = this.genDiff(tool, params);
      res.diff = diff;
      res.needApproval = !!diff && !this.options.autoConfirm;
    }
    if (tool.name === 'bash') {
      const risk = classifyCommandRisk(params?.command || '');
      res.metadata = {
        riskLevel: risk.riskLevel,
        requiresConfirmation: risk.requiresConfirmation,
      } as any;
      if (risk.requiresConfirmation && this.currentLevel === 'default') {
        res.needApproval = true;
        res.diff = `风险命令: ${params?.command || ''}`;
      }
    }
    return res;
  }
  private genDiff(tool: any, params: any): string | null {
    if (tool.name === 'write_file' && params.filePath) {
      const fullPath = resolvePolicyPath(this.options.workspaceRoot, params.filePath);
      if (!fs.existsSync(fullPath)) return null;
      return generateUnifiedDiff(fs.readFileSync(fullPath, 'utf8'), params.content, params.filePath);
    }
    if (tool.name === 'edit_file' && params.filePath) {
      const fullPath = resolvePolicyPath(this.options.workspaceRoot, params.filePath);
      if (!fs.existsSync(fullPath)) return null;
      const before = fs.readFileSync(fullPath, 'utf8');
      const after = params.isRegex
        ? before.replace(new RegExp(params.search, 'g'), params.replace)
        : before.split(params.search).join(params.replace);
      return generateUnifiedDiff(before, after, params.filePath);
    }
    if (tool.name === 'apply_patch' && Array.isArray(params.patches)) {
      const diffs = params.patches.flatMap((patch: any) => {
        if (!patch?.filePath) return [];
        const fullPath = resolvePolicyPath(this.options.workspaceRoot, patch.filePath);
        if (!fs.existsSync(fullPath)) return [];
        const before = fs.readFileSync(fullPath, 'utf8');
        const after = before.split(patch.search).join(patch.replace);
        return after === before ? [] : [generateUnifiedDiff(before, after, patch.filePath)];
      });
      return diffs.join('\n');
    }
    return null;
  }
  async postExecute(tool: any, params: any, result: any) {
    appendAuditLog({
      tool: tool.name,
      params,
      result,
      sessionType: 'policy',
      timestamp: new Date().toISOString(),
    });
  }

  async undo(filePath: string): Promise<string> {
    const logs = fs
      .readFileSync('.agent/audit.jsonl', 'utf-8')
      .split('\n')
      .filter(Boolean)
      .reverse();
    for (const line of logs) {
      const entry = JSON.parse(line);
      if (entry.filePath === filePath && entry.backupPath && fs.existsSync(entry.backupPath)) {
        restoreBackup(entry.backupPath, filePath);
        return `已撤销 ${filePath} 的修改，恢复自备份 ${entry.backupPath}`;
      }
    }
    return '未找到可撤销的备份';
  }

  async getAuditLog(limit = 20): Promise<any[]> {
    if (!fs.existsSync('.agent/audit.jsonl')) return [];
    const lines = fs.readFileSync('.agent/audit.jsonl', 'utf-8').split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  }
}

function resolvePolicyPath(workspaceRoot: string | undefined, filePath: string) {
  if (!workspaceRoot) return path.resolve(process.cwd(), filePath);
  return resolveWorkspacePath(workspaceRoot, filePath);
}

function classifyCommandRisk(command: string): { riskLevel: 'low' | 'medium' | 'high'; requiresConfirmation: boolean } {
  const normalized = command.trim();
  if (!normalized) return { riskLevel: 'low', requiresConfirmation: false };
  if (/(rm\s+-rf|git\s+reset\s+--hard|mkfs|dd\s+if=|shutdown|reboot|:\(\)\s*\{)/.test(normalized)) {
    return { riskLevel: 'high', requiresConfirmation: true };
  }
  if (/(git\s+clean\s+-fd|mv\s+.+\s+\/|chmod\s+-R|chown\s+-R)/.test(normalized)) {
    return { riskLevel: 'medium', requiresConfirmation: true };
  }
  return { riskLevel: 'low', requiresConfirmation: false };
}
