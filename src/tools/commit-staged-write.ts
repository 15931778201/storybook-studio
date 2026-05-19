import { Tool, safeExecute, ToolError } from '../core/tool';
import { z } from 'zod';
import { StagedWriteManager } from '../core/write-protocol';

export class CommitStagedWriteTool extends Tool {
  name = 'commit_staged_write';
  description = '提交暂存的写入操作';
  parameters = z.object({
    stagedId: z.string().describe('暂存操作ID'),
    sessionId: z.string().optional().describe('会话ID'),
  });

  private stagedWriteManager: StagedWriteManager;

  constructor() {
    super();
    this.stagedWriteManager = new StagedWriteManager('.agent/staging');
  }

  protected async executeCore(validatedParams: unknown) {
    const { stagedId, sessionId } = validatedParams as z.infer<typeof this.parameters>;

    return safeExecute(this.name, async () => {
      try {
        const result = await this.stagedWriteManager.commit(stagedId);
        if (result.success) {
          return {
            success: true,
            output: `已成功提交暂存操作: ${result.filePath}`,
            metadata: {
              writeProtocol: 'apply_patch',
              committed: true,
              filePath: result.filePath,
              stagedId,
            },
          };
        } else {
          throw new ToolError(`提交失败: ${stagedId}`, this.name, { stagedId });
        }
      } catch (error: any) {
        throw new ToolError(`提交暂存操作失败: ${error.message}`, this.name, { stagedId });
      }
    });
  }
}