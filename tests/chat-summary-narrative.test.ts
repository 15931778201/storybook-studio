import { describe, expect, it } from 'bun:test';
import { shouldRenderSummaryNarrative } from '../web/src/utils/confirm-presentation';

describe('chat summary narrative rendering', () => {
  it('does not render the final fixed summary template twice', () => {
    const fixed = [
      '改了什么',
      'src/demo.ts',
      '',
      '为什么',
      '收敛写入协议',
      '',
      '测试结果',
      'bun test',
      '结果: 通过',
    ].join('\n');

    expect(shouldRenderSummaryNarrative(fixed)).toBe(false);
  });
});
