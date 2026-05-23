import { describe, expect, it } from 'bun:test';
import { AdaptivePipeline } from '../src/core/adaptive-pipeline';
import { sessionControlStore } from '../src/storage/session-control-store';

class StateProbePipeline extends AdaptivePipeline {
  public modelCalls = 0;
  public verificationCalls = 0;

  protected async callModel(messages: any[], toolsDef: any[]) {
    this.modelCalls += 1;
    const system = messages.map((message) => String(message.content || '')).join('\n');
    if (system.includes('You are executing step 2 of the plan')) {
      return {
        choices: [{
          message: {
            content: '[STEP_DONE] step 2 complete',
          },
        }],
      };
    }

    if (system.includes('You are executing step 1 of the plan')) {
      return {
        choices: [{
          message: {
            tool_calls: [{
              id: 'probe-call',
              type: 'function',
              function: {
                name: 'probe',
                arguments: '{}',
              },
            }],
          },
        }],
      };
    }

    if (system.includes('[PLAN]')) {
      return {
        choices: [{
          message: {
            content: '[PLAN] {"goal":"demo","steps":[{"stepId":1,"description":"step 1","tool":"probe","args":{}},{"stepId":2,"description":"step 2","tool":"probe","args":{}}]} [/PLAN]',
          },
        }],
      };
    }

    return {
      choices: [{
        message: {
          content: '[STEP_DONE] done',
        },
      }],
    };
  }

  protected async runVerification() {
    this.verificationCalls += 1;
    return { commands: ['bun test'], passed: true, output: 'ok' };
  }

  public snapshot() {
    return this.snapshotRuntime();
  }
}

describe('session state machine', () => {
  it('resumes from the saved plan step instead of restarting from the beginning', async () => {
    const pipeline = new StateProbePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [
        { name: 'probe', description: 'probe', parameters: {}, execute: async () => ({ success: true, output: 'ok', metadata: {} }) },
      ],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 3,
    } as any, 'resume-session');

    pipeline.hydrateRuntimeState({
      sessionId: 'resume-session',
      status: 'running',
      mode: 'executing',
      currentStepIndex: 1,
      lastInput: 'build the plan',
      plan: {
        goal: 'demo',
        steps: [
          { stepId: 1, description: 'step 1', tool: 'probe', args: {} },
          { stepId: 2, description: 'step 2', tool: 'probe', args: {} },
        ],
      },
    });

    await pipeline.executeStep([{ role: 'user', content: 'build the plan' } as any], 'build the plan', 2);

    expect(pipeline.modelCalls).toBe(1);
    expect(pipeline.verificationCalls).toBe(0);
    expect(pipeline.snapshot().currentStepIndex).toBe(2);
    expect(pipeline.snapshot().mode).toBe('executing');
  });

  it('pauses before verification when pause is requested during tool execution', async () => {
    const sessionId = 'pause-session';
    const pipeline = new StateProbePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [
        {
          name: 'probe',
          description: 'probe',
          parameters: {},
          execute: async () => {
            sessionControlStore.set({ sessionId, action: 'pause', stepId: 1 });
            return { success: true, output: 'tool ok', metadata: { changedFiles: ['src/a.ts'] } };
          },
        },
      ],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 3,
    } as any, sessionId);

    pipeline.hydrateRuntimeState({
      sessionId,
      status: 'running',
      mode: 'executing',
      currentStepIndex: 0,
      lastInput: 'fix it',
      plan: {
        goal: 'demo',
        steps: [{ stepId: 1, description: 'step 1', tool: 'probe', args: {} }],
      },
    });

    await pipeline.executeStep([{ role: 'user', content: 'fix it' } as any], 'fix it', 2);

    expect(pipeline.verificationCalls).toBe(0);
    expect(sessionControlStore.get(sessionId)?.action).toBe('pause');
    expect(pipeline.snapshot().status).toBe('paused');
  });

  it('supports tool-scoped pause before the current tool executes', async () => {
    const sessionId = 'tool-pause-session';
    let executed = false;
    const pipeline = new StateProbePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [
        {
          name: 'probe',
          description: 'probe',
          parameters: {},
          execute: async () => {
            executed = true;
            return { success: true, output: 'tool ok', metadata: { changedFiles: ['src/a.ts'] } };
          },
        },
      ],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 3,
    } as any, sessionId);

    pipeline.hydrateRuntimeState({
      sessionId,
      status: 'running',
      mode: 'executing',
      currentStepIndex: 0,
      lastInput: 'fix it',
      plan: {
        goal: 'demo',
        steps: [{ stepId: 1, description: 'step 1', tool: 'probe', args: {} }],
      },
    });

    sessionControlStore.set({ sessionId, action: 'pause', stepId: 1, scope: 'tool', toolName: 'probe' } as any);
    await pipeline.executeStep([{ role: 'user', content: 'fix it' } as any], 'fix it', 2);

    expect(executed).toBe(false);
    expect(pipeline.snapshot().status).toBe('paused');
  });
});
