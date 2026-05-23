import { describe, expect, it } from 'bun:test';
import { AdaptivePipeline } from '../src/core/adaptive-pipeline';
import { AgentEventBus } from '../src/core/events';

class OverviewProbePipeline extends AdaptivePipeline {
  public modelCalls = 0;

  protected async callModel() {
    this.modelCalls += 1;
    throw Object.assign(new Error('429 Provider returned error'), { status: 429 });
  }
}

function createPipeline(commands: string[]) {
  const bashTool = {
    name: 'bash',
    description: 'fake bash',
    parameters: {},
    execute: async ({ command }: { command: string }) => {
      commands.push(command);
      if (command.includes('package.json')) {
        return {
          success: true,
          output: [
            '{"name":"agentkit","version":"0.1.0","description":"Universal Agent Framework in TypeScript","dependencies":{"hono":"^4.0.0","openai":"^6.0.0"}}',
            '{"compilerOptions":{"target":"ESNext","module":"ESNext"}}',
            '# AgentKit\n\n## 当前注意事项\n\n- Dockerfile lockfile path may need syncing.',
          ].join('\n---\n'),
        };
      }
      if (command.includes('find . -maxdepth')) {
        return { success: true, output: '.\n./server\n./src\n./src/core\n./src/tools\n./web\n./web/src' };
      }
      if (command.includes('git log')) {
        return { success: true, output: 'abc123 feat: latest\n--- branches ---\n* main' };
      }
      if (command.includes('src/index.ts')) {
        return { success: true, output: '--- src/index.ts ---\nexport { AgentLoop } from "./core/agent-loop";' };
      }
      if (command.includes('.opencode')) {
        return { success: true, output: 'total 0\ndrwxr-xr-x plans' };
      }
      if (command.includes('.agent')) {
        return { success: true, output: 'config.db\nskills\nknowledge' };
      }
      if (command.includes('AGENTS.md')) {
        return { success: true, output: '# Agent 指令\n\n当被问到"了解当前项目"...' };
      }
      return { success: true, output: '' };
    },
  };

  return new OverviewProbePipeline({
    model: 'deepseek/deepseek-v4-flash:free',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'fake',
    tools: [bashTool],
    memory: { getAll: async () => [] },
    contextMgr: { compress: async (messages: any) => messages, options: { maxTokens: 2000 } },
    policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
    maxIterations: 3,
  } as any, 'overview-session');
}

describe('AdaptivePipeline workspace overview requests', () => {
  it('uses deterministic workspace inspection instead of first-iteration direct answer or model planning', async () => {
    const commands: string[] = [];
    const pipeline = createPipeline(commands);
    const events: any[] = [];
    const bus = AgentEventBus.getInstance();
    const handler = (event: any) => events.push(event);
    bus.on('message-overview-session', handler);

    try {
      const result = await pipeline.executeStep(
        [{ role: 'user', content: '了解一下当前工作区这个项目' } as any],
        '了解一下当前工作区这个项目',
        1,
      );

      expect(result.done).toBe(true);
      expect(pipeline.modelCalls).toBe(0);
      expect(commands.some((command) => command.includes('cat package.json'))).toBe(true);
      expect(commands.some((command) => command.includes('git log --oneline -10'))).toBe(true);
      expect(result.finalOutput).toContain('1. 项目定位 + 技术栈');
      expect(result.finalOutput).toContain('```mermaid');
      expect(result.finalOutput).toContain('5. API 路由表格');
      expect(events.some((event) => event.type === 'final' && event.content === result.finalOutput)).toBe(true);
    } finally {
      bus.off('message-overview-session', handler);
    }
  });

  it('treats README improvement requests as workspace-inspection work before planning', async () => {
    const commands: string[] = [];
    const pipeline = createPipeline(commands);

    const result = await pipeline.executeStep(
      [{ role: 'user', content: '帮我完善readme.md' } as any],
      '帮我完善readme.md',
      1,
    );

    expect(result.done).toBe(true);
    expect(pipeline.modelCalls).toBe(0);
    expect(commands.some((command) => command.includes('cat package.json'))).toBe(true);
    expect(result.finalOutput).toContain('1. 项目定位 + 技术栈');
  });
});
