import { describe, expect, it } from 'bun:test';
import { buildPatchArgsForWrite, shouldPromoteWriteToPatch } from '../src/core/write-protocol';

describe('write protocol helpers', () => {
  it('promotes existing-file rewrites to apply_patch by default', () => {
    expect(shouldPromoteWriteToPatch('before', 'after')).toBe(true);
    expect(shouldPromoteWriteToPatch('', 'after')).toBe(false);
    expect(shouldPromoteWriteToPatch('same', 'same')).toBe(false);
  });

  it('builds a single full-file patch from write_file arguments', () => {
    expect(buildPatchArgsForWrite('src/demo.ts', 'before', 'after')).toEqual({
      patches: [
        {
          filePath: 'src/demo.ts',
          search: 'before',
          replace: 'after',
          expectedMatches: 1,
        },
      ],
    });
  });
});
