import { describe, expect, it } from 'bun:test';
import { buildMessageWindow } from '../web/src/utils/chat-message-window';
import type { ChatMessage } from '../web/src/types/messages';

function message(id: number): ChatMessage {
  return {
    id: `m-${id}`,
    role: id % 2 === 0 ? 'assistant' : 'user',
    content: `message ${id}`,
    contentType: 'text',
  };
}

describe('chat message windowing', () => {
  it('keeps recent messages visible and collapses older history by default', () => {
    const messages = Array.from({ length: 12 }, (_, index) => message(index + 1));

    const windowed = buildMessageWindow(messages, { recentCount: 5, historyExpanded: false });

    expect(windowed.hiddenCount).toBe(7);
    expect(windowed.visibleMessages.map((item) => item.id)).toEqual(['m-8', 'm-9', 'm-10', 'm-11', 'm-12']);
    expect(windowed.shouldShowHistoryToggle).toBe(true);
  });

  it('renders all messages when history is expanded', () => {
    const messages = Array.from({ length: 12 }, (_, index) => message(index + 1));

    const windowed = buildMessageWindow(messages, { recentCount: 5, historyExpanded: true });

    expect(windowed.hiddenCount).toBe(0);
    expect(windowed.visibleMessages).toHaveLength(12);
    expect(windowed.shouldShowHistoryToggle).toBe(true);
  });
});
