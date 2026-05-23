import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DefaultStepPipeline } from '../src/core/default-step-pipeline';
import { Tool } from '../src/core/tool';

class CaptureApplyPatchTool extends Tool {
  name = 'apply_patch';
  description = 'capture apply patch';
  parameters = z.object({
    patches: z.array(z.any()),
    checkpoint: z.any().optional(),
  });
  public receivedArgs: any[] = [];

  protected async executeCore(validatedParams: any) {
    this.receivedArgs.push(validatedParams);
    return {
      success: true,
      output: 'patched',
      metadata: {
        changedFiles: ['src/demo.ts'],
        checkpoint: {
          completedHunks: 2,
          patches: validatedParams.patches,
        },
      },
    };
  }
}

class ApplyPatchResumePipeline extends DefaultStepPipeline {
  async runToolCall(toolCall: any, messages: any[]) {
    return this.executeSingleToolCall(toolCall, messages, { suppressVerification: true });
  }
}

describe('apply patch runtime resume', () => {
  it('injects applyPatchCheckpoint from runtime state into apply_patch args', async () => {
    const tool = new CaptureApplyPatchTool();
    const pipeline = new ApplyPatchResumePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [tool],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 1,
    } as any, 'apply-patch-runtime');

    pipeline.setRuntimeData('applyPatchCheckpoint', {
      completedHunks: 1,
      patches: [
        { filePath: 'src/demo.ts', search: 'a', replace: 'A' },
        { filePath: 'src/demo.ts', search: 'b', replace: 'B' },
      ],
    });

    await pipeline.runToolCall({
      id: 'patch-1',
      type: 'function',
      function: {
        name: 'apply_patch',
        arguments: JSON.stringify({
          patches: [
            { filePath: 'src/demo.ts', search: 'a', replace: 'A' },
            { filePath: 'src/demo.ts', search: 'b', replace: 'B' },
          ],
        }),
      },
    }, [{ role: 'user', content: 'resume patch' }]);

    expect(tool.receivedArgs).toHaveLength(1);
    expect(tool.receivedArgs[0].checkpoint?.completedHunks).toBe(1);
  });
});
