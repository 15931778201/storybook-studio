import { describe, expect, it } from 'bun:test';
import { mergeSummaryIntoAssistantMessage, shouldSuppressStandaloneSystemMessage } from '../web/src/utils/chat-summary-flow';

describe('chat summary flow helpers', () => {
  it('suppresses standalone system messages that are now folded into summary', () => {
    expect(shouldSuppressStandaloneSystemMessage('test-result')).toBe(true);
    expect(shouldSuppressStandaloneSystemMessage('repair-start')).toBe(true);
    expect(shouldSuppressStandaloneSystemMessage('repair-end')).toBe(true);
    expect(shouldSuppressStandaloneSystemMessage('repair-skipped')).toBe(true);
    expect(shouldSuppressStandaloneSystemMessage('summary-ready')).toBe(true);
    expect(shouldSuppressStandaloneSystemMessage('plan')).toBe(false);
  });

  it('merges summary metadata into the active assistant message instead of appending a new one', () => {
    const next = mergeSummaryIntoAssistantMessage([
      { id: 'assistant-1', role: 'assistant', content: '最终说明', contentType: 'text', metadata: {} },
    ], 'assistant-1', { verification: { passed: true, commands: [], output: '' }, appliedFiles: [] });

    expect(next).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '最终说明',
        contentType: 'summary',
        metadata: {
          summary: { verification: { passed: true, commands: [], output: '' }, appliedFiles: [] },
        },
      },
    ]);
  });
});
