import { describe, expect, it } from 'bun:test';
import { buildModelErrorMessage, parseToolCallFromText, shouldUseNativeTools, withTimeout } from '../src/core/default-step-pipeline';

describe('DefaultStepPipeline tool mode helpers', () => {
  it('parses nested JSON tool calls from text fallback output', () => {
    const parsed = parseToolCallFromText(`
      我会创建技能。
      [TOOL_CALL] {"name":"create_skill","arguments":{"name":"frontend-deploy","title":"前端部署","description":"构建并部署前端","steps":[{"tool":"bash","params":{"command":"bun run build"},"description":"构建前端"}],"tags":["frontend","deploy"]}} [/TOOL_CALL]
    `);

    expect(parsed?.name).toBe('create_skill');
    expect(JSON.parse(parsed!.arguments)).toEqual({
      name: 'frontend-deploy',
      title: '前端部署',
      description: '构建并部署前端',
      steps: [
        {
          tool: 'bash',
          params: { command: 'bun run build' },
          description: '构建前端',
        },
      ],
      tags: ['frontend', 'deploy'],
    });
  });

  it('uses text tool mode for OpenRouter free models', () => {
    const useNativeTools = shouldUseNativeTools({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      baseURL: 'https://openrouter.ai/api/v1',
    });

    expect(useNativeTools).toBe(false);
  });

  it('returns fallback when retrieval work exceeds the configured timeout', async () => {
    const result = await withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve('late result'), 50)),
      1,
      ''
    );

    expect(result).toBe('');
  });

  it('does not append thought-chain text into user-visible error messages', () => {
    const message = buildModelErrorMessage({ status: 500, message: 'provider failed' });

    expect(message).toContain('模型服务端错误');
    expect(message).toContain('provider failed');
    expect(message).not.toContain('思考链');
    expect(message).not.toContain('调用工具');
  });
});
