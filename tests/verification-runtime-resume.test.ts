import { describe, expect, it } from 'bun:test';

const { DefaultStepPipeline } = await import('../src/core/default-step-pipeline');

class VerificationResumePipeline extends DefaultStepPipeline {
  public executed: string[] = [];

  protected async runVerification(changedFiles: string[]) {
    const autoVerification = await import('../src/core/auto-verification');
    const commands = autoVerification.recommendVerificationCommands(changedFiles);
    const adaptive = this as any;
    const resumeFrom = adaptive.getRuntimeData?.('verificationCheckpoint');

    const result = await autoVerification.runCheckpointedVerification(
      commands,
      async (command: string) => {
        this.executed.push(command);
        return { success: true, output: `${command}: ok` };
      },
      {
        sessionId: 'verification-runtime',
        resumeFrom: resumeFrom as any,
      },
    );

    adaptive.setRuntimeData?.('verificationCheckpoint', {
      commands,
      completed: commands.length,
      outputs: result.output.split('\n\n'),
    });
    return result;
  }
}

describe('verification runtime resume', () => {
  it('reuses verification checkpoint from runtime snapshot', async () => {
    const pipeline = new VerificationResumePipeline({
      model: 'gpt-4o',
      apiKey: 'fake',
      tools: [],
      memory: { getAll: async () => [] },
      contextMgr: { compress: async (m: any) => m, options: { maxTokens: 2000 } },
      policy: { preExecute: async () => ({ allowed: true }), postExecute: async () => {} },
      maxIterations: 1,
    } as any, 'verification-runtime');

    (pipeline as any).setRuntimeData('verificationCheckpoint', {
      commands: ['CI=1 bun test', 'CI=1 bun run --cwd web build'],
      completed: 1,
      outputs: ['$ CI=1 bun test\nCI=1 bun test: ok'],
    });

    const result = await (pipeline as any).runVerification(['src/demo.ts', 'web/src/App.tsx']);

    expect(pipeline.executed).toEqual(['CI=1 bun run --cwd web build']);
    expect(result.passed).toBe(true);
    expect(result.output).toContain('CI=1 bun test');
    expect(result.output).toContain('CI=1 bun run --cwd web build');
  });
});
