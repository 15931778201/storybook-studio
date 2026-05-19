import { describe, expect, it } from 'bun:test';
import { buildFinalAnswerFromSummary } from '../src/core/final-answer';

describe('final answer formatting', () => {
  it('formats the final answer as changed/why/tests with repair details', () => {
    const output = buildFinalAnswerFromSummary({
      appliedFiles: ['src/demo.ts'],
      changes: [
        {
          kind: 'initial',
          toolName: 'apply_patch',
          changedFiles: ['src/demo.ts'],
        },
      ],
      repair: {
        attempted: true,
        success: true,
        changes: [
          {
            kind: 'repair',
            toolName: 'apply_patch',
            changedFiles: ['src/demo.ts'],
          },
        ],
      },
      verification: {
        commands: ['CI=1 bun test'],
        passed: true,
        output: '$ CI=1 bun test\nok',
      },
    }, '修复测试失败并统一写入协议');

    expect(output).toContain('改了什么');
    expect(output).toContain('为什么');
    expect(output).toContain('测试结果');
    expect(output).toContain('src/demo.ts');
    expect(output).toContain('CI=1 bun test');
    expect(output).toContain('自动修复');
  });
});
