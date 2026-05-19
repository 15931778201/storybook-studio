import { describe, expect, it } from 'bun:test';
import { buildConfirmPreview, filterToolArgsByDecision } from '../src/core/confirm-selection';

describe('confirm selection helpers', () => {
  it('builds multi-file preview summary from a unified diff bundle', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@',
      '-export const a = 1;',
      '+export const a = 2;',
      'diff --git a/b.ts b/b.ts',
      '--- /dev/null',
      '+++ b/b.ts',
      '@@',
      '+export const b = true;',
    ].join('\n');

    const preview = buildConfirmPreview('apply_patch', {}, diff);

    expect(preview.files).toHaveLength(2);
    expect(preview.summary).toEqual({
      total: 2,
      accepted: 2,
      added: 1,
      deleted: 0,
      modified: 1,
    });
  });

  it('filters apply_patch args by accepted files', () => {
    const args = {
      patches: [
        { filePath: 'a.ts', search: '1', replace: '2' },
        { filePath: 'b.ts', search: 'true', replace: 'false' },
      ],
    };

    const nextArgs = filterToolArgsByDecision('apply_patch', args, {
      approved: true,
      selectedFiles: { 'a.ts': true, 'b.ts': false },
    });

    expect(nextArgs).toEqual({
      patches: [{ filePath: 'a.ts', search: '1', replace: '2' }],
    });
  });
});
