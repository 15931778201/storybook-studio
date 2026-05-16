
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
