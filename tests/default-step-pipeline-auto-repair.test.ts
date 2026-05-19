import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { AgentEventBus } from '../src/core/events';
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
      metadata: { changedFiles: [validatedParams.filePath] },
    };
  }
}

class FakeEditTool extends Tool {
  name = 'edit_file';
  description = 'fake edit';
  parameters = z.object({ filePath: z.string(), search: z.string(), replace: z.string() });
  calls = 0;

  protected async executeCore(validatedParams: any) {
    this.calls += 1;
    return {
      success: true,
      output: `edited ${validatedParams.filePath}`,
      metadata: { changedFiles: [validatedParams.filePath] },
    };
  }
}

class TestPipeline extends DefaultStepPipeline {
  private verificationResults = [
    {
      commands: ['CI=1 bun test'],
      passed: false,
      output: '$ CI=1 bun test\nfailing test output\n[退出码 1]',
    },
    {
      commands: ['CI=1 bun test'],
      passed: true,
      output: '$ CI=1 bun test\nok',
    },
  ];

  constructor(config: any, sessionId: string, private repairToolCall: any) {
    super(config, sessionId);
  }

  protected async callModel() {
    return {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [this.repairToolCall],
          },
        },
      ],
    };
  }

  async runToolCall(toolCall: any, messages: any[]) {
    return this.executeSingleToolCall(toolCall, messages);
  }

  protected async runVerification() {
    return this.verificationResults.shift()!;
  }
}

describe('DefaultStepPipeline auto repair loop', () => {
  it('re-runs verification after an automatic repair when tests fail', async () => {
    const editTool = new FakeEditTool();
    const pipeline = new TestPipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [new FakeWriteTool(), editTool],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (messages: any) => messages, options: { maxTokens: 2000 } },
      policy: {
        preExecute: async () => ({ allowed: true, needApproval: false }),
        postExecute: async () => {},
      },
      maxIterations: 1,
    }, 'repair-test', {
      id: 'repair-1',
      type: 'function',
      function: {
        name: 'edit_file',
        arguments: JSON.stringify({
          filePath: 'src/demo.ts',
          search: 'broken',
          replace: 'fixed',
        }),
      },
    });

    const bus = AgentEventBus.getInstance();
    const events: any[] = [];
    const handler = (data: any) => events.push(data);
    bus.on('message-repair-test', handler);

    try {
      await pipeline.runToolCall({
        id: 'write-1',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({
            filePath: 'src/demo.ts',
            content: 'broken',
          }),
        },
      }, [{ role: 'user', content: 'fix failing tests' }]);
    } finally {
      bus.off('message-repair-test', handler);
    }

    expect(editTool.calls).toBe(1);
    expect(events.some((event) => event.type === 'repair-start')).toBe(true);
    expect(events.some((event) => event.type === 'repair-end' && event.success === true)).toBe(true);

    const summary = events.find((event) => event.type === 'summary-ready');
    expect(summary).toBeDefined();
    expect(summary.summary.verification.passed).toBe(true);
    expect(summary.summary.verification.commands).toEqual(['CI=1 bun test']);
    expect(summary.summary.changes).toEqual([
      {
        kind: 'initial',
        toolName: 'write_file',
        changedFiles: ['src/demo.ts'],
        diff: undefined,
      },
    ]);
    expect(summary.summary.repair).toEqual({
      attempted: true,
      success: true,
      changes: [
        {
          kind: 'repair',
          toolName: 'edit_file',
          changedFiles: ['src/demo.ts'],
          diff: undefined,
        },
      ],
    });
  });
});
