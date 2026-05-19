import { describe, expect, it } from 'bun:test';
import { recommendVerificationCommands, summarizeAppliedFiles } from '../src/core/auto-verification';

describe('auto verification helpers', () => {
  it('recommends test and web build commands based on changed file types', () => {
    const commands = recommendVerificationCommands([
      'src/core/default-step-pipeline.ts',
      'web/src/pages/ChatPage.tsx',
    ]);

    expect(commands).toEqual([
      'CI=1 bun test',
      'CI=1 bun run --cwd web build',
    ]);
  });

  it('deduplicates normalized changed files for summary output', () => {
    const files = summarizeAppliedFiles([
      'src/../src/core/default-step-pipeline.ts',
      'src/core/default-step-pipeline.ts',
    ]);

    expect(files).toEqual(['src/core/default-step-pipeline.ts']);
  });
});
