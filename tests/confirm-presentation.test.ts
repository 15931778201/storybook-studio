import { describe, expect, it } from 'bun:test';
import { buildSelectionStatus, formatDiffContentForDisplay, shouldRenderSummaryNarrative } from '../web/src/utils/confirm-presentation';

describe('confirm presentation helpers', () => {
  it('builds accepted and rejected file counts by change type', () => {
    const status = buildSelectionStatus([
      { filePath: 'a.ts', changeType: 'modified' },
      { filePath: 'b.ts', changeType: 'added' },
      { filePath: 'c.ts', changeType: 'deleted' },
    ], {
      'a.ts': true,
      'b.ts': false,
      'c.ts': true,
    });

    expect(status.total).toBe(3);
    expect(status.accepted).toBe(2);
    expect(status.rejected).toBe(1);
    expect(status.acceptedGroups.modified.map((file) => file.filePath)).toEqual(['a.ts']);
    expect(status.acceptedGroups.deleted.map((file) => file.filePath)).toEqual(['c.ts']);
    expect(status.rejectedGroups.added.map((file) => file.filePath)).toEqual(['b.ts']);
  });

  it('suppresses summary narrative when final answer already follows the fixed template', () => {
    expect(shouldRenderSummaryNarrative([
      '改了什么',
      'src/demo.ts',
      '',
      '为什么',
      '修复失败测试',
      '',
      '测试结果',
      'CI=1 bun test',
      '结果: 通过',
    ].join('\n'))).toBe(false);

    expect(shouldRenderSummaryNarrative('补充说明：保留一个额外人工说明段落')).toBe(true);
    expect(shouldRenderSummaryNarrative('')).toBe(false);
  });

  it('formats json and trims noisy trailing whitespace for formatted diff view', () => {
    expect(formatDiffContentForDisplay('json', '{"b":2,"a":1}')).toBe('{\n  "b": 2,\n  "a": 1\n}');
    expect(formatDiffContentForDisplay('typescript', 'const a = 1;  \n')).toBe('const a = 1;');
  });
});
