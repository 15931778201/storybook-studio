import type { ChatMessage } from '../types/messages';

const SUPPRESSED_SYSTEM_EVENTS = new Set([
  'test-result',
  'repair-start',
  'repair-end',
  'repair-skipped',
  'summary-ready',
]);

export function shouldSuppressStandaloneSystemMessage(eventType: string) {
  return SUPPRESSED_SYSTEM_EVENTS.has(eventType);
}

export function mergeSummaryIntoAssistantMessage(
  messages: ChatMessage[],
  assistantId: string | null,
  summary: Record<string, any>,
) {
  if (!assistantId) {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: '变更总结',
        contentType: 'summary' as const,
        metadata: { summary },
      },
    ];
  }

  return messages.map((message) =>
    message.id === assistantId
      ? {
          ...message,
          contentType: 'summary' as const,
          metadata: {
            ...(message.metadata || {}),
            summary,
          },
        }
      : message,
  );
}
