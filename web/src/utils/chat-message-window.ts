import type { ChatMessage } from '../types/messages';

export interface MessageWindowOptions {
  recentCount: number;
  historyExpanded: boolean;
}

export interface MessageWindow {
  visibleMessages: ChatMessage[];
  hiddenCount: number;
  shouldShowHistoryToggle: boolean;
}

export function buildMessageWindow(messages: ChatMessage[], options: MessageWindowOptions): MessageWindow {
  const recentCount = Math.max(1, options.recentCount);
  if (options.historyExpanded || messages.length <= recentCount) {
    return {
      visibleMessages: messages,
      hiddenCount: 0,
      shouldShowHistoryToggle: messages.length > recentCount,
    };
  }

  const hiddenCount = messages.length - recentCount;
  return {
    visibleMessages: messages.slice(hiddenCount),
    hiddenCount,
    shouldShowHistoryToggle: true,
  };
}
