import { Tool, safeExecute, ToolResult, ToolError } from '../core/tool';
import { StagedWriteManager, StagedWriteEntry, AuditChangeRecord, buildAuditChangeRecord } from '../core/write-protocol';
import fs from 'fs';
import path from 'path';

export interface StagedWriteToolOptions {
  workspaceRoot?: string;
  sessionId: string;
  stagedWriteManager?: StagedWriteManager;
}

export abstract class StagedWriteTool extends Tool {
  protected stagedWriteManager: StagedWriteManager;
  protected sessionId: string;
  protected workspaceRoot?: string;

  constructor(options: StagedWriteToolOptions) {
    super();
    this.sessionId = options.sessionId;
    this.workspaceRoot = options.workspaceRoot;
    this.stagedWriteManager = options.stagedWriteManager || new StagedWriteManager('.agent/staging');
  }

  protected resolvePath(filePath: string): string {
    if (!this.workspaceRoot) {
      return path.resolve(process.cwd(), filePath);
    }
    return path.resolve(this.workspaceRoot, filePath);
  }

  /**
   * 执行staged write操作：先暂存，等待确认后再提交
   */
  protected async executeStagedWrite(
    filePath: string,
    originalContent: string,
    patchedContent: string,
    backupPath: string,
    action: 'create' | 'modify' | 'delete' = 'modify'
  ): Promise<ToolResult> {
    const fullPath = this.resolvePath(filePath);
    
    // 创建暂存条目
    const stagedEntry: Omit<StagedWriteEntry, 'id' | 'status' | 'createdAt'> = {
      sessionId: this.sessionId,
      toolName: this.name,
      filePath,
      fullPath,
      originalContent,
      patchedContent,
      diff: '',
      backupPath,
      createdAt: new Date().toISOString(),
    };

    try {
      const staged = await this.stagedWriteManager.stage(stagedEntry);
      
      // 创建审计记录
      const auditRecord: AuditChangeRecord = buildAuditChangeRecord({
        sessionId: this.sessionId,
        toolName: this.name,
        filePath,
        action: 'stage',
        diff: staged.diff,
        backupPath,
        status: 'pending',
        metadata: {
          stagedId: staged.id,
          action,
        },
      });
      
      return {
        success: true,
        output: `已暂存 ${action} 操作到 staging 区: ${filePath}`,
        metadata: {
          writeProtocol: 'apply_patch',
          stagedId: staged.id,
          filePath,
          action,
          backupPath,
        },
      };
    } catch (error: any) {
      throw new ToolError(`暂存失败: ${error.message}`, this.name, { filePath });
    }
  }

  /**
   * 提交暂存的写入操作
   */
  protected async commitStagedWrite(stagedId: string): Promise<ToolResult> {
    try {
      const result = await this.stagedWriteManager.commit(stagedId);
      if (result.success) {
        const auditRecord: AuditChangeRecord = buildAuditChangeRecord({
          sessionId: this.sessionId,
          toolName: this.name,
          filePath: result.filePath,
          action: 'commit',
          diff: '',
          backupPath: '',
          status: 'committed',
          metadata: { stagedId },
        });
        
        return {
          success: true,
          output: `已提交暂存操作: ${result.filePath}`,
          metadata: {
            writeProtocol: 'apply_patch',
            committed: true,
            filePath: result.filePath,
            stagedId,
          },
        };
      } else {
        throw new ToolError(`提交失败`, this.name, { stagedId, filePath: result.filePath });
      }
    } catch (error: any) {
      throw new ToolError(`提交失败: ${error.message}`, this.name, { stagedId });
    }
  }

  /**
   * 回滚暂存的写入操作
   */
  protected async rollbackStagedWrite(stagedId: string): Promise<ToolResult> {
    try {
      const result = await this.stagedWriteManager.rollback(stagedId);
      if (result.success) {
        const auditRecord: AuditChangeRecord = buildAuditChangeRecord({
          sessionId: this.sessionId,
          toolName: this.name,
          filePath: result.filePath,
          action: 'rollback',
          diff: '',
          backupPath: '',
          status: 'rolled_back',
          metadata: { stagedId },
        });
        
        return {
          success: true,
          output: `已回滚暂存操作: ${result.filePath}`,
          metadata: {
            writeProtocol: 'apply_patch',
            rolledBack: true,
            filePath: result.filePath,
            stagedId,
          },
        };
      } else {
        throw new ToolError(`回滚失败`, this.name, { stagedId, filePath: result.filePath });
      }
    } catch (error: any) {
      throw new ToolError(`回滚失败: ${error.message}`, this.name, { stagedId });
    }
  }
}