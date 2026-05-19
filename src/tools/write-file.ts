import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import fs from 'fs';
import { createBackup } from '../utils/backup';
import { generateUnifiedDiff } from '../utils/diff';
import { appendAuditLog } from '../utils/logger';
import { resolveWorkspacePath, WorkspaceToolOptions } from './workspace';
import { StagedWriteManager } from '../core/write-protocol';

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = '将内容写入文件，自动备份并生成 diff 预览';
  parameters = z.object({ 
    filePath: z.string().describe('文件路径'), 
    content: z.string().describe('文件内容'),
    sessionId: z.string().optional().describe('会话ID，用于暂存操作'),
    staged: z.boolean().optional().default(false).describe('是否使用暂存模式')
  });
  
  // 自然语言示例：展示如何调用此工具
  example = `要创建一个新文件，请使用 write_file 工具：
{
  "filePath": "src/utils/helper.js",
  "content": "console.log('Hello, World!');"
}

这将在 src/utils/ 目录下创建 helper.js 文件，内容为 console.log('Hello, World!');`;

  private stagedWriteManager: StagedWriteManager;
  private options: WorkspaceToolOptions;

  constructor(options: WorkspaceToolOptions = {}) { 
    super(); 
    this.options = options;
    this.stagedWriteManager = new StagedWriteManager('.agent/staging');
  }

  resolvePath(filePath: string): string {
    return resolveWorkspacePath(this.options.workspaceRoot, filePath);
  }

  protected async executeCore(validatedParams: unknown) {
    const { filePath, content, sessionId, staged } = validatedParams as z.infer<typeof this.parameters>;
    
    return safeExecute(this.name, async () => {
      const fullPath = this.resolvePath(filePath);
      
      // 如果文件不存在，直接创建（不需要确认）
      if (!fs.existsSync(fullPath)) {
        const backupPath = createBackup(fullPath);
        fs.writeFileSync(fullPath, content, 'utf8');
        
        const auditRecord = {
          id: `audit-${Date.now()}`,
          sessionId: sessionId || '',
          toolName: this.name,
          writeProtocol: 'apply_patch' as const,
          filePath,
          action: 'apply' as const,
          diff: '',
          backupPath,
          status: 'committed' as const,
          timestamp: new Date().toISOString(),
          metadata: { operation: 'create' }
        };
        appendAuditLog(auditRecord);
        
        return { 
          success: true, 
          output: `文件 ${filePath} 创建成功`, 
          metadata: { 
            backupPath, 
            diff: '', 
            changedFiles: [filePath], 
            writeProtocol: 'apply_patch',
            committed: true
          } 
        };
      }
      
      // 文件存在，根据staged参数决定处理方式
      const oldContent = fs.readFileSync(fullPath, 'utf8');
      if (oldContent === content) {
        return {
          success: true,
          output: `文件 ${filePath} 内容未变化`,
          metadata: { changedFiles: [], writeProtocol: 'apply_patch', committed: true },
        };
      }
      
      if (staged) {
        // 使用 staged write 模式
        const diff = generateUnifiedDiff(oldContent, content, filePath);
        const backupPath = createBackup(fullPath);
        
        const stagedEntry = await this.stagedWriteManager.stage({
          sessionId: sessionId || 'default-session',
          toolName: this.name,
          filePath,
          fullPath,
          originalContent: oldContent,
          patchedContent: content,
          diff,
          backupPath,
        });
        
        const auditRecord = {
          id: `audit-${Date.now()}`,
          sessionId: sessionId || 'default-session',
          toolName: this.name,
          writeProtocol: 'apply_patch' as const,
          filePath,
          action: 'stage' as const,
          diff,
          backupPath,
          status: 'pending' as const,
          timestamp: new Date().toISOString(),
          metadata: { stagedId: stagedEntry.id, operation: 'overwrite' }
        };
        appendAuditLog(auditRecord);
        
        return {
          success: true,
          output: `文件 ${filePath} 的修改已暂存，等待确认`,
          metadata: {
            writeProtocol: 'apply_patch',
            changedFiles: [filePath],
            diff,
            stagedId: stagedEntry.id,
            backupPath: stagedEntry.backupPath,
            pendingConfirmation: true
          },
        };
      } else {
        // 直接写入（保持向后兼容）
        const diff = generateUnifiedDiff(oldContent, content, filePath);
        const backupPath = createBackup(fullPath);
        fs.writeFileSync(fullPath, content, 'utf8');
        
        const auditRecord = {
          id: `audit-${Date.now()}`,
          sessionId: sessionId || '',
          toolName: this.name,
          writeProtocol: 'apply_patch' as const,
          filePath,
          action: 'apply' as const,
          diff,
          backupPath,
          status: 'committed' as const,
          timestamp: new Date().toISOString(),
          metadata: { operation: 'overwrite' }
        };
        appendAuditLog(auditRecord);
        
        return {
          success: true,
          output: `文件 ${filePath} 已更新`,
          metadata: {
            writeProtocol: 'apply_patch',
            changedFiles: [filePath],
            diff,
            backupPath,
            committed: true
          },
        };
      }
    });
  }
}