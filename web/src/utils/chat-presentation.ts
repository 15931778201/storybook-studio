import type { ChatMessage } from '../types/messages';

export function shouldRenderMessage(_message: ChatMessage): boolean {
  return true;
}

export function getBubbleRole(role: ChatMessage['role']): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant';
}

export function getMessagePlacement(role: ChatMessage['role']): 'start' | 'end' {
  return role === 'user' ? 'end' : 'start';
}

export function finalizeThinkingMessage(messages: ChatMessage[], thinkingId: string | null): ChatMessage[] {
  if (!thinkingId) return messages;
  return messages.flatMap((message) => {
    if (message.id !== thinkingId) return [message];
    if (message.role !== 'thinking') return [message];
    if (!message.steps || message.steps.length === 0) return [];
    return [{ ...message, content: '执行过程' }];
  });
}

export function appendFinalMessage(
  messages: ChatMessage[],
  thinkingId: string | null,
  finalMessage: ChatMessage
): ChatMessage[] {
  return [...finalizeThinkingMessage(messages, thinkingId), finalMessage];
}
