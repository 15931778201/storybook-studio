import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { Tool } from '../src/core/tool';

const { DefaultStepPipeline } = await import('../src/core/default-step-pipeline');

class FakeWriteTool extends Tool {
  name = 'write_file';
  description = 'fake write';
  parameters = z.object({ filePath: z.string(), content: z.string() });

  protected async executeCore(validatedParams: any) {
    return {
      success: true,
      output: `wrote ${validatedParams.filePath}`,
      metadata: {
        changedFiles: [validatedParams.filePath],
        diff: `diff --git a/${validatedParams.filePath} b/${validatedParams.filePath}`,
      },
    };
  }
}

class FinalAnswerPipeline extends DefaultStepPipeline {
  private modelCalls = 0;

  protected async runVerification() {
    return {
      commands: ['CI=1 bun test'],
      passed: true,
      output: '$ CI=1 bun test\nok',
    };
  }

  protected async callModel() {
    this.modelCalls += 1;
    if (this.modelCalls === 1) {
      return {
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: JSON.stringify({ filePath: 'src/demo.ts', content: 'export const ok = true;' }),
              },
            }],
          },
        }],
      };
    }

    return {
      choices: [{
        message: {
          content: '这里是模型自由生成的回答',
          tool_calls: undefined,
        },
      }],
    };
  }
}

describe('final answer template', () => {
  it('uses the summary template after code changes instead of free-form final text', async () => {
    const messages: any[] = [{ role: 'user', content: '修复这个问题' }];
    const pipeline = new FinalAnswerPipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [new FakeWriteTool()],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (next: any) => next, options: { maxTokens: 2000 } },
      policy: {
        preExecute: async () => ({ allowed: true, needApproval: false }),
        postExecute: async () => {},
      },
      maxIterations: 2,
    }, 'final-answer');

    const first = await pipeline.executeStep(messages, '修复这个问题', 1);
    expect(first.done).toBe(true);
    expect(first.finalOutput).toContain('改了什么');
    expect(first.finalOutput).toContain('为什么');
    expect(first.finalOutput).toContain('测试结果');
    expect(first.finalOutput).toContain('src/demo.ts');
    expect(first.finalOutput).not.toContain('这里是模型自由生成的回答');
  });
});
