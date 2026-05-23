import { describe, expect, it } from 'bun:test';
import { AgentLoop } from '../src/core/agent-loop';
import { DefaultStepPipeline } from '../src/core/default-step-pipeline';

class ContextProbePipeline extends DefaultStepPipeline {
  async exposePreparedMessages(messages: any[], userInput: string) {
    return this.prepareContext(messages, userInput);
  }
}

describe('session runtime and context injection', () => {
  it('injects repo map, file tree and git context into prepared messages when project tools exist', async () => {
    const pipeline = new ContextProbePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [
        { name: 'repo_map', execute: async () => ({ success: true, output: 'repo map output' }) },
        { name: 'file_tree_summary', execute: async () => ({ success: true, output: 'tree summary output' }) },
        { name: 'git_context', execute: async () => ({ success: true, output: 'git context output' }) },
      ],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 1,
    } as any, 'context-session');

    const prepared = await pipeline.exposePreparedMessages([{ role: 'user', content: 'understand repo' }], 'understand repo');
    const systemContents = prepared.filter((message) => message.role === 'system').map((message) => message.content);

    expect(systemContents.some((content) => String(content).includes('repo map output'))).toBe(true);
    expect(systemContents.some((content) => String(content).includes('tree summary output'))).toBe(true);
    expect(systemContents.some((content) => String(content).includes('git context output'))).toBe(true);
  });

  it('supports abort and rerun of the same session input', async () => {
    let calls = 0;
    const pipeline = {
      executeStep: async (_messages: any[], userInput: string) => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { done: true, finalOutput: `done:${userInput}:${calls}` };
      },
    };

    const config: any = {
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 1,
    };

    const abortController = new AbortController();
    abortController.abort();

    const aborted = await new AgentLoop(config, 'runtime-session', pipeline as any).run('task', abortController.signal);
    expect(aborted).toBe('任务已被取消。');

    const resumed = await new AgentLoop(config, 'runtime-session', pipeline as any).run('task');
    expect(resumed).toBe('done:task:1');
  });
});
