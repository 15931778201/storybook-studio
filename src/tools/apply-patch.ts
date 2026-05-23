import fs from 'fs';
import { z } from 'zod';
import { Tool, safeExecute, ToolError } from '../core/tool';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';
import { checkHunkConflicts, type UnifiedWriteResult, type AuditChangeRecord, StagedWriteManager } from '../core/write-protocol';

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
    sessionId: z.string().optional().describe('会话ID，用于暂存操作'),
    staged: z.boolean().optional().default(false).describe('是否使用暂存模式'),
    checkpoint: z.object({
      completedHunks: z.number().int().nonnegative(),
      patches: z.array(patchInstructionSchema),
    }).optional(),
  });

  private stagedWriteManager: StagedWriteManager;
  private options: WorkspaceToolOptions;

  constructor(options: WorkspaceToolOptions = {}) {
    super();
    this.options = options;
    this.stagedWriteManager = new StagedWriteManager('.agent/staging');
  }

  resolvePath(filePath: string) {
    return resolveWorkspacePath(this.options.workspaceRoot, filePath);
  }

  protected async executeCore(validatedParams: unknown) {
    const { patches, sessionId, staged, checkpoint } = validatedParams as z.infer<typeof this.parameters>;

    return safeExecute(this.name, async () => {
      // 如果启用了staged模式，先暂存所有操作
      if (staged) {
        return await this.executeStaged(patches, sessionId || 'default-session');
      }
      
      // 否则执行直接写入（保持向后兼容）
      return await this.executeDirect(patches, checkpoint);
    });
  }

  private async executeDirect(
    patches: z.infer<typeof patchInstructionSchema>[],
    checkpoint?: { completedHunks: number; patches: z.infer<typeof patchInstructionSchema>[] }
  ) {
    const diffParts: string[] = [];
    const changedFiles: string[] = [];
    const backups: Array<{ filePath: string; fullPath: string; backupPath: string }> = [];
    let conflict: UnifiedWriteResult['conflict'] | undefined;
    const startHunkIndex = checkpoint && JSON.stringify(checkpoint.patches) === JSON.stringify(patches)
      ? Math.min(checkpoint.completedHunks, patches.length)
      : 0;

    try {
      for (let hunkIndex = startHunkIndex; hunkIndex < patches.length; hunkIndex++) {
        const patch = patches[hunkIndex];
        const fullPath = this.resolvePath(patch.filePath);
        if (!fs.existsSync(fullPath)) {
          conflict = { filePath: patch.filePath, reason: '文件不存在', hunkIndex };
          throw new ToolError(`文件不存在: ${patch.filePath}`, this.name, { filePath: patch.filePath });
        }

        const before = fs.readFileSync(fullPath, 'utf-8');

        // Hunk 级冲突检测
        const hunkCheck = checkHunkConflicts(before, [patch]);
        if (hunkCheck.hasConflict) {
          const hunkConflict = hunkCheck.conflicts[0];
          conflict = {
            filePath: patch.filePath,
            reason: humanizeConflictReason(hunkConflict.reason),
            hunkIndex: hunkConflict.hunkIndex,
            searchSnippet: hunkConflict.searchSnippet,
          };
          throw new ToolError(
            `${humanizeConflictReason(hunkConflict.reason)}: ${patch.filePath} hunk#${hunkIndex}`,
            this.name,
            { filePath: patch.filePath, hunkIndex, reason: hunkConflict.reason },
          );
        }

        // 保留原有基础校验作为双保险
        const contextCheck = checkPatchContext(before, patch.search, patch.beforeContext, patch.afterContext);
        if (!contextCheck.ok) {
          conflict = {
            filePath: patch.filePath,
            reason: '上下文冲突',
            hunkIndex,
            searchSnippet: patch.search.slice(0, 80),
            beforeContextSnippet: patch.beforeContext?.slice(0, 40),
            afterContextSnippet: patch.afterContext?.slice(0, 40),
          };
          throw new ToolError(`上下文冲突: ${patch.filePath}`, this.name, { filePath: patch.filePath });
        }

        const matches = before.split(patch.search).length - 1;
        if (matches === 0) {
          conflict = { filePath: patch.filePath, reason: '未找到匹配内容', hunkIndex, searchSnippet: patch.search.slice(0, 80) };
          throw new ToolError(`未找到匹配内容: ${patch.filePath}`, this.name, { filePath: patch.filePath });
        }
        if (patch.expectedMatches != null && matches !== patch.expectedMatches) {
          conflict = {
            filePath: patch.filePath,
            reason: '匹配次数不符合预期',
            hunkIndex,
            searchSnippet: patch.search.slice(0, 80),
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

        // 使用结构化审计记录
        const auditRecord: AuditChangeRecord = {
          id: `audit-${Date.now()}-${hunkIndex}`,
          sessionId: '',
          toolName: this.name,
          writeProtocol: 'apply_patch',
          filePath: patch.filePath,
          action: 'apply',
          diff,
          backupPath,
          status: 'committed',
          timestamp: new Date().toISOString(),
          metadata: {
            hunkIndex,
            expectedMatches: patch.expectedMatches,
            actualMatches: matches,
          },
        };
        appendAuditLog(auditRecord);
      }
    } catch (error: any) {
      for (const backup of backups.reverse()) {
        if (backup.backupPath && fs.existsSync(backup.backupPath)) {
          fs.copyFileSync(backup.backupPath, backup.fullPath);
        }
      }
      // 回滚审计记录
      const rollbackRecord: AuditChangeRecord = {
        id: `audit-${Date.now()}-rollback`,
        sessionId: '',
        toolName: this.name,
        writeProtocol: 'apply_patch',
        filePath: changedFiles[0] || '',
        action: 'rollback',
        diff: '',
        backupPath: '',
        status: 'rolled_back',
        timestamp: new Date().toISOString(),
        metadata: {
          conflictReason: error.message,
        },
      };
      appendAuditLog(rollbackRecord);

      const result: UnifiedWriteResult = {
        writeProtocol: 'apply_patch',
        changedFiles: [],
        appliedFiles: changedFiles,
        diff: '',
        backupCount: backups.filter((entry) => entry.backupPath).length,
        rollbackPerformed: backups.length > 0,
        rolledBackFiles: backups.map((backup) => backup.filePath),
        conflict,
      };
      return {
        success: false,
        output: error.message,
        metadata: result,
      };
    }

      const result: UnifiedWriteResult = {
        writeProtocol: 'apply_patch',
        changedFiles,
        appliedFiles: changedFiles,
        diff: diffParts.join('\n'),
        backupCount: backups.filter((entry) => entry.backupPath).length,
        rollbackPerformed: false,
        rolledBackFiles: [],
        checkpoint: {
          completedHunks: patches.length,
          patches,
        },
      };
    return {
      success: true,
      output: changedFiles.length > 0
        ? `已应用 ${changedFiles.length} 个补丁: ${changedFiles.join(', ')}`
        : '没有需要应用的变更',
      metadata: result,
    };
  }

  private async executeStaged(patches: z.infer<typeof patchInstructionSchema>[], sessionId: string) {
    const stagedEntries: string[] = [];
    const changedFiles: string[] = [];
    const diffs: string[] = [];

    try {
      for (let hunkIndex = 0; hunkIndex < patches.length; hunkIndex++) {
        const patch = patches[hunkIndex];
        const fullPath = this.resolvePath(patch.filePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
          throw new ToolError(`文件不存在: ${patch.filePath}`, this.name, { filePath: patch.filePath });
        }

        const before = fs.readFileSync(fullPath, 'utf-8');
        const after = before.split(patch.search).join(patch.replace);
        
        if (after === before) {
          continue;
        }

        // 执行冲突检测
        const hunkCheck = checkHunkConflicts(before, [patch]);
        if (hunkCheck.hasConflict) {
          const hunkConflict = hunkCheck.conflicts[0];
          throw new ToolError(
            `${humanizeConflictReason(hunkConflict.reason)}: ${patch.filePath} hunk#${hunkIndex}`,
            this.name,
            { filePath: patch.filePath, hunkIndex, reason: hunkConflict.reason },
          );
        }

        const diff = generateUnifiedDiff(before, after, patch.filePath);
        const backupPath = createBackup(fullPath);

        // 暂存写入操作
        const stagedEntry = await this.stagedWriteManager.stage({
          sessionId,
          toolName: this.name,
          filePath: patch.filePath,
          fullPath,
          originalContent: before,
          patchedContent: after,
          diff,
          backupPath,
        });

        stagedEntries.push(stagedEntry.id);
        changedFiles.push(patch.filePath);
        diffs.push(normalizePatchHeaders(diff, patch.filePath));

        // 记录暂存审计日志
        const auditRecord: AuditChangeRecord = {
          id: `audit-${Date.now()}-${hunkIndex}`,
          sessionId,
          toolName: this.name,
          writeProtocol: 'apply_patch',
          filePath: patch.filePath,
          action: 'stage',
          diff,
          backupPath,
          status: 'pending',
          timestamp: new Date().toISOString(),
          metadata: {
            hunkIndex,
            stagedId: stagedEntry.id,
            expectedMatches: patch.expectedMatches,
            actualMatches: before.split(patch.search).length - 1,
          },
        };
        appendAuditLog(auditRecord);
      }

      return {
        success: true,
        output: `已暂存 ${changedFiles.length} 个补丁操作，等待用户确认`,
        metadata: {
          writeProtocol: 'apply_patch',
          changedFiles,
          diff: diffs.join('\n'),
          stagedIds: stagedEntries,
          pendingConfirmation: true,
        },
      };
    } catch (error: any) {
      // 清理已暂存的条目（如果有的话）
      for (const stagedId of stagedEntries) {
        try {
          await this.stagedWriteManager.rollback(stagedId);
        } catch {
          // 忽略清理错误
        }
      }
      
      return {
        success: false,
        output: error.message,
        metadata: {
          writeProtocol: 'apply_patch',
          changedFiles: [],
          stagedIds: [],
          error: error.message,
        },
      };
    }
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

function humanizeConflictReason(reason: string) {
  switch (reason) {
    case 'not_found':
      return '未找到匹配内容';
    case 'multiple_matches':
      return '匹配次数不符合预期';
    case 'context_mismatch':
      return '上下文冲突';
    case 'line_offset_drift':
      return '上下文行偏移冲突';
    default:
      return reason;
  }
}
