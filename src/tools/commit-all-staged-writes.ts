import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import { StagedWriteManager } from '../core/write-protocol';

export class CommitAllStagedWritesTool extends Tool {
  name = 'commit_all_staged_writes';
  description = '批量提交所有暂存的写入操作';
  parameters = z.object({
    sessionId: z.string().describe('会话ID'),
  });

  private stagedWriteManager: StagedWriteManager;

  constructor() {
    super();
    this.stagedWriteManager = new StagedWriteManager('.agent/staging');
  }

  protected async executeCore(validatedParams: unknown) {
    const { sessionId } = validatedParams as z.infer<typeof this.parameters>;

    return safeExecute(this.name, async () => {
      try {
        const result = await this.stagedWriteManager.commitAll(sessionId);
        const totalCommitted = result.committed.length;
        const totalRolledBack = result.rolledBack.length;
        
        let output = `批量提交完成: ${totalCommitted} 个文件已提交`;
        if (totalRolledBack > 0) {
          output += `, ${totalRolledBack} 个文件回滚失败`;
        }
        
        return {
          success: totalRolledBack === 0,
          output,
          metadata: {
            writeProtocol: 'apply_patch',
            committedFiles: result.committed,
            rolledBackFiles: result.rolledBack,
            totalCommitted,
            totalRolledBack,
          },
        };
      } catch (error: any) {
        throw new ToolError(`批量提交失败: ${error.message}`, this.name, { sessionId });
      }
    });
  }
}