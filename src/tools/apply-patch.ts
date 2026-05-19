import fs from 'fs';
import { z } from 'zod';
import { Tool, safeExecute, ToolError } from '../core/tool';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';

const patchInstructionSchema = z.object({
  filePath: z.string().describe('要修改的文件路径'),
  search: z.string().describe('要查找的原始文本'),
  replace: z.string().describe('替换后的文本'),
  expectedMatches: z.number().int().positive().optional().describe('预期命中次数，若不匹配则拒绝写入'),
  beforeContext: z.string().optional().describe('匹配文本前的上下文块，不匹配则视为冲突'),
  afterContext: z.string().optional().describe('匹配文本后的上下文块，不匹配则视为冲突'),
});

export class ApplyPatchTool extends Tool {
  name = 'apply_patch';
  description = '按补丁指令对一个或多个文件应用精确修改，并返回统一 diff';
  parameters = z.object({
    patches: z.array(patchInstructionSchema).min(1).describe('要应用的补丁列表'),
  });

  constructor(private options: WorkspaceToolOptions = {}) {
    super();
  }

  resolvePath(filePath: string) {
    return resolveWorkspacePath(this.options.workspaceRoot, filePath);
  }

  protected async executeCore(validatedParams: unknown) {
    const { patches } = validatedParams as z.infer<typeof this.parameters>;

    return safeExecute(this.name, async () => {
      const diffParts: string[] = [];
      const changedFiles: string[] = [];
      const backups: Array<{ filePath: string; fullPath: string; backupPath: string }> = [];
      let conflict: Record<string, unknown> | undefined;

      try {
        for (const patch of patches) {
          const fullPath = this.resolvePath(patch.filePath);
          if (!fs.existsSync(fullPath)) {
            conflict = { filePath: patch.filePath, reason: '文件不存在' };
            throw new ToolError(`文件不存在: ${patch.filePath}`, this.name, { filePath: patch.filePath });
          }

          const before = fs.readFileSync(fullPath, 'utf-8');
          const contextCheck = checkPatchContext(before, patch.search, patch.beforeContext, patch.afterContext);
          if (!contextCheck.ok) {
            conflict = {
              filePath: patch.filePath,
              reason: '上下文冲突',
              search: patch.search,
              beforeContext: patch.beforeContext,
              afterContext: patch.afterContext,
            };
            throw new ToolError(`上下文冲突: ${patch.filePath}`, this.name, { filePath: patch.filePath });
          }
          const matches = before.split(patch.search).length - 1;
          if (matches === 0) {
            conflict = { filePath: patch.filePath, reason: '未找到匹配内容', search: patch.search };
            throw new ToolError(`未找到匹配内容: ${patch.filePath}`, this.name, { filePath: patch.filePath });
          }
          if (patch.expectedMatches != null && matches !== patch.expectedMatches) {
            conflict = {
              filePath: patch.filePath,
              reason: '匹配次数不符合预期',
              expectedMatches: patch.expectedMatches,
              actualMatches: matches,
            };
            throw new ToolError(
              `匹配次数不符合预期: ${patch.filePath}，期望 ${patch.expectedMatches}，实际 ${matches}`,
              this.name,
              { filePath: patch.filePath, expectedMatches: patch.expectedMatches, actualMatches: matches },
            );
          }

          const after = before.split(patch.search).join(patch.replace);
          if (after === before) {
            continue;
          }

          const backupPath = createBackup(fullPath);
          backups.push({ filePath: patch.filePath, fullPath, backupPath });
          fs.writeFileSync(fullPath, after, 'utf-8');
          const diff = generateUnifiedDiff(before, after, patch.filePath);
          diffParts.push(normalizePatchHeaders(diff, patch.filePath));
          changedFiles.push(patch.filePath);

          appendAuditLog({
            tool: this.name,
            filePath: patch.filePath,
            backupPath,
            diff,
            status: 'applied',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        for (const backup of backups.reverse()) {
          if (backup.backupPath && fs.existsSync(backup.backupPath)) {
            fs.copyFileSync(backup.backupPath, backup.fullPath);
          }
        }
        appendAuditLog({
          tool: this.name,
          action: 'rollback',
          changedFiles,
          reason: error.message,
          conflict,
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          output: error.message,
          metadata: {
            changedFiles: [],
            appliedFiles: changedFiles,
            rollbackPerformed: backups.length > 0,
            rolledBackFiles: backups.map((backup) => backup.filePath),
            backupCount: backups.filter((entry) => entry.backupPath).length,
            conflict,
          },
        };
      }

      return {
        success: true,
        output: changedFiles.length > 0
          ? `已应用 ${changedFiles.length} 个补丁: ${changedFiles.join(', ')}`
          : '没有需要应用的变更',
        metadata: {
          writeProtocol: 'apply_patch',
          changedFiles,
          appliedFiles: changedFiles,
          backupCount: backups.filter((entry) => entry.backupPath).length,
          rollbackPerformed: false,
          rolledBackFiles: [],
          diff: diffParts.join('\n'),
        },
      };
    });
  }
}

function normalizePatchHeaders(diff: string, filePath: string): string {
  return diff
    .replace(`--- a\n`, `--- a/${filePath}\n`)
    .replace(`+++ b\n`, `+++ b/${filePath}\n`)
    .replace(/^Index: .+$/m, `diff --git a/${filePath} b/${filePath}`);
}

function checkPatchContext(content: string, search: string, beforeContext?: string, afterContext?: string) {
  const index = content.indexOf(search);
  if (index === -1) return { ok: true };

  if (beforeContext != null) {
    const beforeSlice = content.slice(Math.max(0, index - beforeContext.length), index);
    if (beforeSlice !== beforeContext) {
      return { ok: false };
    }
  }

  if (afterContext != null) {
    const start = index + search.length;
    const afterSlice = content.slice(start, start + afterContext.length);
    if (afterSlice !== afterContext) {
      return { ok: false };
    }
  }

  return { ok: true };
}
