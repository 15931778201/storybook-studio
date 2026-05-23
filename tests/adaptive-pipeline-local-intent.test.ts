import { describe, expect, it } from 'bun:test';
import { AdaptivePipeline } from '../src/core/adaptive-pipeline';

class LocalIntentProbePipeline extends AdaptivePipeline {
  public modelCalls = 0;
  public lastToolsCount = 0;
  public lastPrompt = '';

  protected async callModel(messages: any[], toolsDef: any[]) {
    this.modelCalls += 1;
    this.lastToolsCount = toolsDef.length;
    this.lastPrompt = messages.map((message) => String(message.content || '')).join('\n');
    return {
      choices: [{
        message: {
          content: '已进入修复模式。',
        },
      }],
    };
  }
}

function createPipeline() {
  return new LocalIntentProbePipeline({
    model: 'deepseek/deepseek-v4-flash:free',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'fake',
    tools: [
      { name: 'read_file', description: 'read', parameters: {}, execute: async () => ({ success: true, output: 'ok' }) },
      { name: 'bash', description: 'bash', parameters: {}, execute: async () => ({ success: true, output: 'ok' }) },
    ],
    memory: { getAll: async () => [] },
    contextMgr: { compress: async (messages: any) => messages, options: { maxTokens: 2000 } },
    policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
    maxIterations: 3,
  } as any, 'local-intent-session');
}

describe('AdaptivePipeline local intent routing', () => {
  it('routes bugfix requests to tool-enabled work mode instead of zero-tool planning', async () => {
    const pipeline = createPipeline();
    const result = await pipeline.executeStep(
      [{ role: 'user', content: '帮我修复这个 429 报错' } as any],
      '帮我修复这个 429 报错',
      1,
    );

    expect(result.done).toBe(true);
    expect(pipeline.modelCalls).toBe(1);
    expect(pipeline.lastToolsCount).toBeGreaterThan(0);
    expect(pipeline.lastPrompt).toContain('工作模式：修复');
    expect(pipeline.lastPrompt).not.toContain('Analyze the user');
  });
});
