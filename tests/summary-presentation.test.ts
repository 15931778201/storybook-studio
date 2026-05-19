import { describe, expect, it } from 'bun:test';
import { buildSummarySections } from '../web/src/utils/summary-presentation';

describe('summary presentation helpers', () => {
  it('groups initial changes, repair changes, and verification result into UI sections', () => {
    const sections = buildSummarySections({
      appliedFiles: ['src/demo.ts'],
      verification: {
        commands: ['CI=1 bun test'],
        passed: true,
        output: '$ CI=1 bun test\nok',
      },
      changes: [
        {
          kind: 'initial',
          toolName: 'write_file',
          changedFiles: ['src/demo.ts'],
          diff: 'diff --git a/src/demo.ts b/src/demo.ts\n--- a/src/demo.ts\n+++ b/src/demo.ts\n@@\n-broken\n+fixed',
        },
      ],
      repair: {
        attempted: true,
        success: true,
        changes: [
          {
            kind: 'repair',
            toolName: 'edit_file',
            changedFiles: ['src/demo.ts'],
            diff: 'diff --git a/src/demo.ts b/src/demo.ts\n--- a/src/demo.ts\n+++ b/src/demo.ts\n@@\n-broken\n+fixed',
          },
        ],
      },
    });

    expect(sections.map((section) => section.key)).toEqual(['initial', 'repair', 'verification']);
    expect(sections[0].title).toBe('本次变更');
    expect(sections[1].title).toBe('自动修复');
    expect(sections[2].status).toBe('passed');
    expect(sections[1].changes?.[0].bundle.files[0]?.filePath).toBe('src/demo.ts');
    expect(sections[2].commands).toEqual(['CI=1 bun test']);
  });

  it('includes rollback and conflict sections for failed patch writes', () => {
    const sections = buildSummarySections({
      appliedFiles: [],
      verification: {
        commands: [],
        passed: false,
        output: '未执行测试',
      },
      failure: {
        rollbackPerformed: true,
        rolledBackFiles: ['src/demo.ts'],
        conflict: {
          filePath: 'src/demo.ts',
          reason: '上下文冲突',
        },
      },
    });

    expect(sections.map((section) => section.key)).toEqual(['failure', 'verification']);
    expect(sections[0].title).toBe('写入失败');
    expect(sections[0].status).toBe('failed');
    expect(sections[0].details).toContain('已回滚: src/demo.ts');
    expect(sections[0].details).toContain('冲突文件: src/demo.ts');
    expect(sections[0].details).toContain('冲突原因: 上下文冲突');
  });

  it('keeps per-change multi-file summary counts for summary cards', () => {
    const sections = buildSummarySections({
      appliedFiles: ['a.ts', 'b.ts'],
      verification: {
        commands: ['bun test'],
        passed: true,
        output: 'ok',
      },
      changes: [
        {
          kind: 'initial',
          toolName: 'apply_patch',
          changedFiles: ['a.ts', 'b.ts'],
          diff: [
            'diff --git a/a.ts b/a.ts',
            '--- a/a.ts',
            '+++ b/a.ts',
            '@@',
            '-const a = 1;',
            '+const a = 2;',
            'diff --git a/b.ts b/b.ts',
            '--- /dev/null',
            '+++ b/b.ts',
            '@@',
            '+export const b = true;',
          ].join('\n'),
        },
      ],
    });

    expect(sections[0].changes?.[0].bundle.fileSummary).toEqual({
      added: 1,
      deleted: 0,
      modified: 1,
    });
  });
});
